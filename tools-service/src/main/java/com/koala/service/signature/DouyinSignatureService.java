package com.koala.service.signature;

import com.koala.service.utils.HttpClientUtil;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Executes Douyin signature algorithms in the current JVM. The GraalJS bootstrap and
 * A-Bogus/live-signature integration are migrated from the sibling Tiktok-live project.
 */
public final class DouyinSignatureService {
    public static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36";

    private static final Logger LOGGER = LoggerFactory.getLogger(DouyinSignatureService.class);
    private static final String X_BOGUS_SCRIPT = "signature/xbogus.js";
    private static final String A_BOGUS_SCRIPT = "signature/dy_ab.js";
    private static final String LIVE_SIGN_SCRIPT = "signature/dy_live_sign.js";
    private static final String TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final String TTWID_REGISTER_URL = "https://ttwid.bytedance.com/ttwid/union/register/";
    private static final String TTWID_REGISTER_BODY = "{\"region\":\"cn\",\"aid\":1768,\"needFid\":false,"
            + "\"service\":\"www.ixigua.com\",\"migrate_info\":{\"ticket\":\"\",\"source\":\"java\"},"
            + "\"cbUrlProtocol\":\"https\",\"union\":true}";
    private static final Pattern TTWID_PATTERN = Pattern.compile("(?:^|;\\s*)ttwid=([^;]+)");
    private static final Duration TTWID_TTL = Duration.ofHours(12);
    private static final DouyinSignatureService INSTANCE = new DouyinSignatureService();

    private final Object scriptLock = new Object();
    private final Object tokenLock = new Object();
    private final SecureRandom secureRandom = new SecureRandom();
    private volatile Context xBogusContext;
    private volatile Context aBogusContext;
    private volatile Context liveSignContext;
    private volatile String cachedTtwid = "";
    private volatile Instant cachedTtwidExpiresAt = Instant.EPOCH;

    private DouyinSignatureService() {
    }

    public static DouyinSignatureService getInstance() {
        return INSTANCE;
    }

    public String generateXBogus(String query, String userAgent) {
        synchronized (scriptLock) {
            Value function = getXBogusContext().getBindings("js").getMember("sign_x_bogus");
            String result = function.execute(nullToEmpty(query), defaultUserAgent(userAgent)).asString();
            requireSignature(result, "X-Bogus");
            return result;
        }
    }

    public String generateABogus(String query, String body) {
        synchronized (scriptLock) {
            Value function = getABogusContext().getBindings("js").getMember("get_ab");
            String result = function.execute(nullToEmpty(query), nullToEmpty(body)).asString();
            requireSignature(result, "A-Bogus");
            return result;
        }
    }

    /** Generates the live WebSocket X-Bogus used by Tiktok-live. */
    public String generateLiveSignature(String roomId, String userUniqueId) {
        String raw = "live_id=1,aid=6383,version_code=180800,webcast_sdk_version=1.0.15,"
                + "room_id=" + roomId + ",sub_room_id=,sub_channel_id=,did_rule=3,user_unique_id="
                + userUniqueId + ",device_platform=web,device_type=,ac=,identity=audience";
        String xMsStub = md5(raw);
        synchronized (scriptLock) {
            Value result = getLiveSignContext().getBindings("js").getMember("get_signature").execute(xMsStub);
            Value member = result.getMember("X-Bogus");
            String signature = member == null || member.isNull() ? "" : member.asString();
            requireSignature(signature, "live X-Bogus");
            return signature;
        }
    }

    public String generateMsToken() {
        StringBuilder token = new StringBuilder(107);
        for (int index = 0; index < 107; index++) {
            token.append(TOKEN_CHARS.charAt(secureRandom.nextInt(TOKEN_CHARS.length())));
        }
        return token.toString();
    }

    /**
     * ttwid is issued by ByteDance rather than calculated by the signature algorithm.
     * Cache it locally so signing never depends on the former port-55012 service.
     */
    public String getTtwid() {
        Instant now = Instant.now();
        if (!cachedTtwid.isBlank() && now.isBefore(cachedTtwidExpiresAt)) {
            return cachedTtwid;
        }
        synchronized (tokenLock) {
            now = Instant.now();
            if (!cachedTtwid.isBlank() && now.isBefore(cachedTtwidExpiresAt)) {
                return cachedTtwid;
            }
            try {
                HttpClientUtil.HttpResult response = HttpClientUtil.postJsonResponse(
                        TTWID_REGISTER_URL,
                        java.util.Map.of("Content-Type", "application/json", "User-Agent", USER_AGENT),
                        TTWID_REGISTER_BODY);
                String issued = extractTtwid(response.headerValues("set-cookie"));
                if (!issued.isBlank()) {
                    cachedTtwid = issued;
                    cachedTtwidExpiresAt = now.plus(TTWID_TTL);
                }
            } catch (IOException exception) {
                LOGGER.warn("Unable to refresh ttwid; continuing with the configured Douyin cookie", exception);
            }
            return cachedTtwid;
        }
    }

    private Context getXBogusContext() {
        if (xBogusContext == null) {
            xBogusContext = createContext(X_BOGUS_SCRIPT);
        }
        return xBogusContext;
    }

    private Context getABogusContext() {
        if (aBogusContext == null) {
            aBogusContext = createContext(A_BOGUS_SCRIPT);
        }
        return aBogusContext;
    }

    private Context getLiveSignContext() {
        if (liveSignContext == null) {
            liveSignContext = createContext(LIVE_SIGN_SCRIPT);
        }
        return liveSignContext;
    }

    private Context createContext(String resourcePath) {
        try {
            ClassPathResource resource = new ClassPathResource(resourcePath);
            String script = resource.getContentAsString(StandardCharsets.UTF_8);
            Context context = Context.newBuilder("js")
                    .allowHostAccess(HostAccess.NONE)
                    .allowIO(false)
                    .option("engine.WarnInterpreterOnly", "false")
                    .build();
            context.eval("js", bootstrapScript());
            context.eval("js", script);
            LOGGER.info("Loaded in-process Douyin signature script: {}", resourcePath);
            return context;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load Douyin signature script " + resourcePath, exception);
        }
    }

    private static String bootstrapScript() {
        return """
                var global = globalThis;
                var self = globalThis;
                var module = {exports:{}};
                var exports = module.exports;
                var console = {log:function(){},warn:function(){},error:function(){}};
                var require = function(){ return {}; };
                var performance = {
                    timeOrigin: Date.now(),
                    now: function(){ return Date.now() - this.timeOrigin; },
                    timing: { navigationStart: Date.now() }
                };
                var __storage = function(){
                    var data = {};
                    return {
                        getItem: function(key){ return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
                        setItem: function(key, value){ data[key] = String(value); },
                        removeItem: function(key){ delete data[key]; },
                        clear: function(){ data = {}; }
                    };
                };
                var localStorage = __storage();
                var sessionStorage = __storage();
                var setTimeout = function(callback){ if (typeof callback === 'function') callback(); return 0; };
                var clearTimeout = function(){};
                var crypto = {
                    getRandomValues: function(array) {
                        for (var i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
                        return array;
                    }
                };
                globalThis.performance = performance;
                globalThis.localStorage = localStorage;
                globalThis.sessionStorage = sessionStorage;
                globalThis.setTimeout = setTimeout;
                globalThis.clearTimeout = clearTimeout;
                globalThis.crypto = crypto;
                """;
    }

    private static String extractTtwid(List<String> cookies) {
        for (String cookie : cookies) {
            Matcher matcher = TTWID_PATTERN.matcher(cookie);
            if (matcher.find()) {
                return matcher.group(1);
            }
        }
        return "";
    }

    private static String md5(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("MD5").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("MD5 is unavailable", exception);
        }
    }

    private static String defaultUserAgent(String userAgent) {
        return userAgent == null || userAgent.isBlank() ? USER_AGENT : userAgent;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static void requireSignature(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " signature script returned an empty value");
        }
    }
}
