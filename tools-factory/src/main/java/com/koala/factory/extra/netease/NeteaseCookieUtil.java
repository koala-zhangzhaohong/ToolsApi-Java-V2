package com.koala.factory.extra.netease;

import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.HttpClientUtil;
import jakarta.annotation.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StreamUtils;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

import static com.koala.service.data.redis.RedisKeyPrefix.*;
import static com.koala.service.utils.HeaderUtil.getNeteaseHttpHeader;

/**
 * @author koala
 * @version 1.0
 * @date 2023/6/16 20:45
 * @description
 */
@Component
public class NeteaseCookieUtil {

    @Resource
    private ResourceLoader resourceLoader;

    @Resource(name = "RedisService")
    private RedisService redisService;

    private static final Long NETEASE_COOKIE_CACHE_TIME = 14 * 24 * 60 * 60L;

    private static final Set<String> COOKIE_ATTRIBUTE_NAMES = Set.of(
            "domain", "path", "expires", "max-age", "secure", "httponly", "samesite", "priority");

    @Resource(name = "getHost")
    private String host;

    public void doRefreshNeteaseCookieTask(String cookie) {
        if (ObjectUtils.isEmpty(cookie)) {
            refreshNeteaseCookie(redisService.get(NETEASE_COOKIE_DATA));
        } else {
            refreshNeteaseCookie(cookie);
        }
    }

    public String getNeteaseCookie() {
        String lock = redisService.get(NETEASE_COOKIE_LOCK);
        String cookie = redisService.get(NETEASE_COOKIE_DATA);
        if (!StringUtils.hasLength(lock)) {
            return refreshNeteaseCookie(getLocalNeteaseCookie());
        } else {
            if (Objects.equals(lock, getCurrentDate())) {
                if (StringUtils.hasLength(cookie)) {
                    return cookie;
                } else {
                    return refreshNeteaseCookie(null);
                }
            } else if (StringUtils.hasLength(cookie)) {
                return refreshNeteaseCookie(cookie);
            } else {
                return refreshNeteaseCookie(null);
            }
        }
    }

    private String getLocalNeteaseCookie() {
        try {
            org.springframework.core.io.Resource resource = resourceLoader.getResource("classpath:cookie/custom.netease.cookie.txt");
            InputStream inputStream = resource.getInputStream();
            String custom = StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
            if (StringUtils.hasLength(custom)) {
                return custom;
            }
        } catch (Exception ignore) {
        }
        return "MUSIC_U=1eb9ce22024bb666e99b6743b2222f29ef64a9e88fda0fd5754714b900a5d70d993166e004087dd3b95085f6a85b059f5e9aba41e3f2646e3cebdbec0317df58c119e5;appver=8.9.75;";
    }

    private String refreshNeteaseCookie(String cookie) {
        String cookieContent = StringUtils.hasLength(cookie) ? cookie : getLocalNeteaseCookie();
        LinkedHashMap<String, String> cookies = parseCookieHeader(cookieContent);
        if (!StringUtils.hasLength(cookies.get("MUSIC_U"))) {
            return null;
        }
        HttpClientUtil.HttpResult responseEntity;
        try {
            responseEntity = HttpClientUtil.postFormResponse(
                    getCurrentHost() + "tools/Netease/weapi/login/token/refresh",
                    getNeteaseHttpHeader(formatCookieHeader(cookies)),
                    Map.of());
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to refresh Netease cookie", exception);
        }
        if (StringUtils.hasLength(responseEntity.body())) {
            Map<String, Object> data = GsonUtil.toMaps(responseEntity.body());
            if (Objects.equals(Objects.toString(data.get("code"), ""), "200")) {
                List<String> cookieData = responseEntity.headerValues("Set-Cookie");
                LinkedHashMap<String, String> refreshedCookies = mergeSetCookieHeaders(cookies, cookieData);
                if (!hasRefreshTokens(refreshedCookies)) return null;
                refreshedCookies.putIfAbsent("__remember_me", "true");
                refreshedCookies.putIfAbsent("os", "pc");
                refreshedCookies.putIfAbsent("appver", "8.9.75");
                String refreshedCookie = formatCookieHeader(refreshedCookies);
                redisService.set(NETEASE_COOKIE_LOCK, getCurrentDate(), NETEASE_COOKIE_CACHE_TIME);
                redisService.set(NETEASE_COOKIE_DATA, refreshedCookie, NETEASE_COOKIE_CACHE_TIME);
                return refreshedCookie;
            }
        }
        return null;
    }

    static LinkedHashMap<String, String> parseCookieHeader(String cookieHeader) {
        LinkedHashMap<String, String> cookies = new LinkedHashMap<>();
        if (!StringUtils.hasLength(cookieHeader)) return cookies;
        Arrays.stream(cookieHeader.split(";"))
                .map(String::trim)
                .filter(StringUtils::hasLength)
                .forEach(item -> {
                    int separator = item.indexOf('=');
                    if (separator <= 0) return;
                    String name = item.substring(0, separator).trim();
                    String value = item.substring(separator + 1).trim();
                    if (!COOKIE_ATTRIBUTE_NAMES.contains(name.toLowerCase(Locale.ROOT))
                            && StringUtils.hasLength(value)) {
                        cookies.putIfAbsent(name, value);
                    }
                });
        return cookies;
    }

    static LinkedHashMap<String, String> mergeSetCookieHeaders(Map<String, String> currentCookies, List<String> setCookieHeaders) {
        LinkedHashMap<String, String> merged = new LinkedHashMap<>(currentCookies);
        if (setCookieHeaders == null) return merged;
        setCookieHeaders.forEach(header -> {
            if (!StringUtils.hasLength(header)) return;
            String cookiePair = header.split(";", 2)[0].trim();
            int separator = cookiePair.indexOf('=');
            if (separator <= 0) return;
            String name = cookiePair.substring(0, separator).trim();
            String value = cookiePair.substring(separator + 1).trim();
            if (!StringUtils.hasLength(name)) return;
            if (StringUtils.hasLength(value)) merged.put(name, value);
            else merged.remove(name);
        });
        return merged;
    }

    static String formatCookieHeader(Map<String, String> cookies) {
        return cookies.entrySet().stream()
                .filter(entry -> StringUtils.hasLength(entry.getKey()) && StringUtils.hasLength(entry.getValue()))
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("; "));
    }

    private static boolean hasRefreshTokens(Map<String, String> cookies) {
        return StringUtils.hasLength(cookies.get("MUSIC_U"))
                && StringUtils.hasLength(cookies.get("MUSIC_A_T"))
                && StringUtils.hasLength(cookies.get("MUSIC_R_T"));
    }

    private static String getCurrentDate() {
        Date currentTime = new Date();
        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMdd");
        return formatter.format(currentTime);
    }

    public String getCurrentHost() {
        String cachedHost = redisService.getAndPersist(SERVICE_HOST);
        if (StringUtils.hasLength(cachedHost)) {
            return cachedHost;
        }
        return host;
    }

}
