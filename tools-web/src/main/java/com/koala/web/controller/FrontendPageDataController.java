package com.koala.web.controller;

import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.Base64Utils;
import com.koala.service.utils.GsonUtil;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.env.Environment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.net.URI;
import java.net.URISyntaxException;

import static com.koala.service.data.redis.RedisKeyPrefix.*;

/**
 * 独立前端页面所需的只读数据接口。
 *
 * <p>旧页面由 Thymeleaf 直接读取 Redis 并注入 Model。拆分前端后，通过该接口
 * 按固定白名单读取相同数据，避免向客户端暴露任意 Redis key 查询能力。</p>
 */
@RestController
@RequestMapping("api/frontend/pages")
public class FrontendPageDataController {

    private static final Logger logger = LoggerFactory.getLogger(FrontendPageDataController.class);

    private static final Set<String> REMOTE_PAGE_PATHS = Set.of(
            "/tools/DouYin/api/ranklist/audience",
            "/tools/DouYin/api/user/profile/other"
    );
    private static final long TIKTOK_MEDIA_TRUST_EXPIRE_SECONDS = 12 * 60 * 60L;

    @Resource(name = "RedisService")
    private RedisService redisService;

    @Resource
    private Environment environment;

    private final HttpClient mediaHttpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    // 用户榜单和资料反查可能需要逐个查询大量用户，不能设置总请求超时。
    private final HttpClient remotePageHttpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @GetMapping("json")
    public ResponseEntity<Object> json(@RequestParam(required = false) String key,
                                       @RequestParam(required = false) String path) {
        if (StringUtils.hasText(path)) {
            try {
                URI uri = URI.create(path);
                if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                    return error(HttpStatus.BAD_REQUEST, "INVALID_REMOTE_PATH");
                }
                if (!isAllowedRemotePage(uri)) {
                    return error(HttpStatus.FORBIDDEN, "REMOTE_PAGE_PATH_NOT_ALLOWED");
                }
                HttpRequest request = HttpRequest.newBuilder(normalizeSelfUri(uri))
                        .GET()
                        .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                        .build();
                HttpResponse<String> upstream = remotePageHttpClient.send(
                        request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (upstream.statusCode() < 200 || upstream.statusCode() >= 300) {
                    logger.warn("[frontendPageData] remote page status={}, uri={}", upstream.statusCode(), uri);
                    return error(HttpStatus.BAD_GATEWAY, "REMOTE_PAGE_UPSTREAM_ERROR");
                }
                String raw = upstream.body();
                if (!StringUtils.hasText(raw)) return error(HttpStatus.NOT_FOUND, "PAGE_DATA_NOT_FOUND");
                return ResponseEntity.ok(GsonUtil.toBean(raw, Object.class));
            } catch (Exception exception) {
                logger.error("[frontendPageData] failed to load remote page: {}", path, exception);
                return error(HttpStatus.BAD_GATEWAY, "REMOTE_PAGE_DATA_ERROR");
            }
        }
        return read(JSON_KEY_PREFIX, key, false);
    }

    private boolean isAllowedRemotePage(URI uri) {
        String realAddress = environment.getProperty("server.real.address");
        String host = uri.getHost();
        boolean selfHost = host != null && (host.equalsIgnoreCase(realAddress)
                || host.equalsIgnoreCase("localhost") || host.equals("127.0.0.1"));
        return selfHost && REMOTE_PAGE_PATHS.contains(uri.getPath());
    }

    private URI normalizeSelfUri(URI uri) throws URISyntaxException {
        int port = Integer.parseInt(environment.getProperty("server.port", "8080"));
        return new URI("http", null, "127.0.0.1", port, uri.getPath(), uri.getQuery(), null);
    }

    @GetMapping("player")
    public ResponseEntity<Object> player(@RequestParam String platform,
                                         @RequestParam String media,
                                         @RequestParam(required = false) String key,
                                         @RequestParam(required = false, defaultValue = "2") String version) {
        String prefix = resolvePrefix(platform, media, version);
        if (prefix == null) {
            return error(HttpStatus.BAD_REQUEST, "UNSUPPORTED_PLAYER");
        }
        ResponseEntity<Object> response = read(prefix, key, true);
        if ("douyin".equalsIgnoreCase(platform) && response.getStatusCode().is2xxSuccessful()) {
            markTrustedDouyinMedia(response.getBody());
        }
        return response;
    }

    @GetMapping("media")
    public ResponseEntity<StreamingResponseBody> media(@RequestParam String key, HttpServletRequest servletRequest) {
        String decodedKey = decodeKey(key);
        if (!StringUtils.hasText(decodedKey)) {
            return mediaError(HttpStatus.BAD_REQUEST, "INVALID_KEY");
        }
        String mediaUrl = redisService.get(SHORT_KEY_PREFIX + decodedKey);
        if (!StringUtils.hasText(mediaUrl)) {
            return mediaError(HttpStatus.NOT_FOUND, "MEDIA_NOT_FOUND");
        }
        try {
            URI uri = URI.create(mediaUrl);
            boolean trustedDouyinMedia = StringUtils.hasText(
                    redisService.get(TIKTOK_MEDIA_KEY_PREFIX + decodedKey));
            if (trustedDouyinMedia ? !isPublicMediaUri(uri) : !isAllowedMediaUri(uri)) {
                return mediaError(HttpStatus.FORBIDDEN, "MEDIA_HOST_NOT_ALLOWED");
            }
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(uri)
                    .GET()
                    .header(HttpHeaders.USER_AGENT, "Mozilla/5.0")
                    .header(HttpHeaders.ACCEPT, "*/*");
            String range = servletRequest.getHeader(HttpHeaders.RANGE);
            if (StringUtils.hasText(range)) requestBuilder.header(HttpHeaders.RANGE, range);

            HttpResponse<InputStream> upstream = mediaHttpClient.send(
                    requestBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());
            StreamingResponseBody body = outputStream -> {
                try (InputStream inputStream = upstream.body()) {
                    inputStream.transferTo(outputStream);
                }
            };
            ResponseEntity.BodyBuilder response = ResponseEntity.status(upstream.statusCode())
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header(HttpHeaders.ACCEPT_RANGES, upstream.headers().firstValue(HttpHeaders.ACCEPT_RANGES).orElse("bytes"));
            upstream.headers().firstValue(HttpHeaders.CONTENT_TYPE).ifPresent(value -> response.header(HttpHeaders.CONTENT_TYPE, value));
            upstream.headers().firstValue(HttpHeaders.CONTENT_LENGTH).ifPresent(value -> response.header(HttpHeaders.CONTENT_LENGTH, value));
            upstream.headers().firstValue(HttpHeaders.CONTENT_RANGE).ifPresent(value -> response.header(HttpHeaders.CONTENT_RANGE, value));
            return response.body(body);
        } catch (Exception exception) {
            return mediaError(HttpStatus.BAD_GATEWAY, "MEDIA_PROXY_ERROR");
        }
    }

    private ResponseEntity<StreamingResponseBody> mediaError(HttpStatus status, String message) {
        byte[] payload = ("{\"code\":" + status.value() + ",\"message\":\"" + message + "\"}")
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.status(status)
                .header(HttpHeaders.CONTENT_TYPE, "application/json;charset=UTF-8")
                .body(outputStream -> outputStream.write(payload));
    }

    private boolean isAllowedMediaUri(URI uri) {
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) return false;
        String host = uri.getHost();
        if (!StringUtils.hasText(host)) return false;
        String normalized = host.toLowerCase();
        return normalized.endsWith(".douyincdn.com")
                || normalized.endsWith(".douyinpic.com")
                || normalized.endsWith(".byteimg.com")
                || normalized.endsWith(".music.126.net")
                || normalized.endsWith(".kugou.com")
                || normalized.endsWith(".kugou.net");
    }

    private boolean isPublicMediaUri(URI uri) {
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) return false;
        if (StringUtils.hasText(uri.getUserInfo()) || !StringUtils.hasText(uri.getHost())) return false;
        try {
            InetAddress[] addresses = InetAddress.getAllByName(uri.getHost());
            if (addresses.length == 0) return false;
            for (InetAddress address : addresses) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                        || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                        || address.isMulticastAddress() || isUniqueLocalIpv6(address)) {
                    return false;
                }
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isUniqueLocalIpv6(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
    }

    private void markTrustedDouyinMedia(Object value) {
        if (value instanceof String text) {
            String encodedKey = shortUrlKey(text);
            if (!StringUtils.hasText(encodedKey)) return;
            String decodedKey = decodeKey(encodedKey);
            if (StringUtils.hasText(decodedKey)
                    && StringUtils.hasText(redisService.get(SHORT_KEY_PREFIX + decodedKey))) {
                redisService.set(TIKTOK_MEDIA_KEY_PREFIX + decodedKey, "1", TIKTOK_MEDIA_TRUST_EXPIRE_SECONDS);
            }
            return;
        }
        if (value instanceof Map<?, ?> map) {
            map.values().forEach(this::markTrustedDouyinMedia);
            return;
        }
        if (value instanceof Iterable<?> iterable) {
            iterable.forEach(this::markTrustedDouyinMedia);
        }
    }

    private String shortUrlKey(String value) {
        try {
            URI uri = URI.create(value);
            if (!"/short".equals(uri.getPath()) || !StringUtils.hasText(uri.getRawQuery())) return null;
            for (String item : uri.getRawQuery().split("&")) {
                int separator = item.indexOf('=');
                if (separator > 0 && "key".equals(item.substring(0, separator))) {
                    return java.net.URLDecoder.decode(item.substring(separator + 1), StandardCharsets.UTF_8);
                }
            }
        } catch (Exception ignored) {
            // Non-URL strings in the player payload are expected and can be skipped.
        }
        return null;
    }

    private String resolvePrefix(String platform, String media, String version) {
        return switch (platform.toLowerCase()) {
            case "douyin" -> TIKTOK_DATA_KEY_PREFIX;
            case "netease" -> switch (media.toLowerCase()) {
                case "music" -> "2".equals(version)
                        ? NETEASE_DATA_TO_WEB_PLAYER_KEY_PREFIX : NETEASE_DATA_KEY_PREFIX;
                case "mv", "video" -> NETEASE_MV_DATA_KEY_PREFIX;
                default -> null;
            };
            case "kugou" -> KUGOU_DATA_KEY_PREFIX;
            default -> null;
        };
    }

    private ResponseEntity<Object> read(String prefix, String inputKey, boolean encoded) {
        if (!StringUtils.hasText(inputKey)) {
            return error(HttpStatus.BAD_REQUEST, "KEY_REQUIRED");
        }
        String key = encoded ? decodeKey(inputKey) : inputKey;
        if (!StringUtils.hasText(key)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_KEY");
        }
        String raw = redisService.get(prefix + key);
        if (!StringUtils.hasText(raw)) {
            return error(HttpStatus.NOT_FOUND, "PAGE_DATA_NOT_FOUND");
        }
        try {
            return ResponseEntity.ok(GsonUtil.toBean(raw, Object.class));
        } catch (Exception exception) {
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "PAGE_DATA_INVALID");
        }
    }

    private String decodeKey(String key) {
        try {
            return new String(Base64Utils.decodeFromUrlSafeString(key), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return key;
        }
    }

    private ResponseEntity<Object> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", status.value());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
