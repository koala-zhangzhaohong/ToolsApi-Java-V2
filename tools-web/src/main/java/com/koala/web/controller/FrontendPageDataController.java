package com.koala.web.controller;

import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.Base64Utils;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.HeaderUtil;
import com.koala.service.utils.HttpClientUtil;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.env.Environment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.util.HashMap;

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
                HttpClientUtil.HttpResult upstream = HttpClientUtil.getResponseWithoutTimeout(
                        normalizeSelfUri(uri).toString(),
                        Map.of(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE),
                        null);
                if (!upstream.isSuccessful()) {
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
    public void media(@RequestParam String key,
                      HttpServletRequest servletRequest,
                      HttpServletResponse servletResponse) {
        String decodedKey = decodeKey(key);
        if (!StringUtils.hasText(decodedKey)) {
            mediaError(servletResponse, HttpStatus.BAD_REQUEST, "INVALID_KEY");
            return;
        }
        String mediaUrl = redisService.get(SHORT_KEY_PREFIX + decodedKey);
        if (!StringUtils.hasText(mediaUrl)) {
            mediaError(servletResponse, HttpStatus.NOT_FOUND, "MEDIA_NOT_FOUND");
            return;
        }
        try {
            URI uri = URI.create(mediaUrl);
            boolean trustedDouyinMedia = StringUtils.hasText(
                    redisService.get(TIKTOK_MEDIA_KEY_PREFIX + decodedKey));
            if (trustedDouyinMedia ? !isPublicMediaUri(uri) : !isAllowedMediaUri(uri)) {
                mediaError(servletResponse, HttpStatus.FORBIDDEN, "MEDIA_HOST_NOT_ALLOWED");
                return;
            }
            HttpClientUtil.doRelay(
                    mediaUrl,
                    HeaderUtil.getMediaRelayHeader(mediaUrl, mediaDestination(servletRequest, false)),
                    null,
                    206,
                    Map.of(HttpHeaders.CACHE_CONTROL, "no-store"),
                    servletRequest,
                    servletResponse);
        } catch (Exception exception) {
            logger.error("[frontendPageData] failed to relay media key={}", decodedKey, exception);
            if (!servletResponse.isCommitted()) mediaError(servletResponse, HttpStatus.BAD_GATEWAY, "MEDIA_PROXY_ERROR");
        }
    }

    /**
     * Stable, range-aware download endpoint for the independent frontend.
     *
     * <p>The old page linked to the short URL directly. That exposed the browser to an
     * expiring CDN redirect and made a failed upstream route look like a local 404. This
     * endpoint resolves the server-generated short key internally and streams the media.
     * Every HTTP Range request remains independent, so browsers and download managers can
     * download multiple byte ranges concurrently without buffering the complete file in a
     * backend JVM.</p>
     */
    @GetMapping("download")
    public void download(@RequestParam String key,
                         HttpServletRequest servletRequest,
                         HttpServletResponse servletResponse) {
        String decodedKey = decodeKey(key);
        if (!StringUtils.hasText(decodedKey)) {
            mediaError(servletResponse, HttpStatus.BAD_REQUEST, "INVALID_KEY");
            return;
        }
        String storedUrl = redisService.get(SHORT_KEY_PREFIX + decodedKey);
        if (!StringUtils.hasText(storedUrl)) {
            mediaError(servletResponse, HttpStatus.NOT_FOUND, "DOWNLOAD_NOT_FOUND");
            return;
        }
        try {
            DownloadTarget target = resolveDownloadTarget(storedUrl, 0);
            if (target == null || !isPublicMediaUri(target.uri())) {
                mediaError(servletResponse, HttpStatus.FORBIDDEN, "DOWNLOAD_HOST_NOT_ALLOWED");
                return;
            }
            Map<String, String> responseHeaders = new HashMap<>();
            responseHeaders.put(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + safeDownloadName(target.fileName(), decodedKey) + "\"");
            responseHeaders.put(HttpHeaders.CACHE_CONTROL, "no-store");
            responseHeaders.put("X-Accel-Buffering", "no");
            responseHeaders.put(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                    "Accept-Ranges, Content-Length, Content-Range, Content-Disposition");
            HttpClientUtil.doRelay(
                    target.uri().toString(),
                    HeaderUtil.getMediaRelayHeader(target.uri().toString(), downloadDestination(target)),
                    null,
                    206,
                    responseHeaders,
                    servletRequest,
                    servletResponse);
        } catch (Exception exception) {
            logger.error("[frontendPageData] failed to relay download key={}", decodedKey, exception);
            if (!servletResponse.isCommitted()) {
                mediaError(servletResponse, HttpStatus.BAD_GATEWAY, "DOWNLOAD_PROXY_ERROR");
            }
        }
    }

    private DownloadTarget resolveDownloadTarget(String value, int depth) throws URISyntaxException {
        if (depth > 3 || !StringUtils.hasText(value)) return null;
        URI uri = URI.create(value);

        if ("/short".equals(uri.getPath())) {
            String nestedKey = queryParameter(uri, "key");
            String decodedNestedKey = decodeKey(nestedKey);
            if (!StringUtils.hasText(decodedNestedKey)) return null;
            return resolveDownloadTarget(redisService.get(SHORT_KEY_PREFIX + decodedNestedKey), depth + 1);
        }

        if (uri.getPath() != null && uri.getPath().endsWith("/doProxy")) {
            String host = queryParameter(uri, "host");
            String path = queryParameter(uri, "path");
            if (!StringUtils.hasText(host) || !StringUtils.hasText(path)) return null;
            URI origin = URI.create(host + path);
            // Some Douyin CDN nodes reject direct origin requests even with a referer. Keep
            // the generated CDN relay as the upstream, but hide it behind our stable endpoint
            // so the browser never navigates to that external service.
            return new DownloadTarget(uri, downloadName(uri, origin));
        }

        if (uri.getPath() != null && (uri.getPath().endsWith("/preview/video")
                || uri.getPath().endsWith("/download/music"))) {
            String encodedPath = queryParameter(uri, "path");
            if (!StringUtils.hasText(encodedPath)) return null;
            URI origin = URI.create(new String(Base64Utils.decodeFromUrlSafeString(encodedPath), StandardCharsets.UTF_8));
            DownloadTarget resolved = resolveDownloadTarget(origin.toString(), depth + 1);
            if (resolved == null) return null;
            String wrapperName = downloadName(uri, resolved.uri());
            return new DownloadTarget(resolved.uri(), StringUtils.hasText(wrapperName) ? wrapperName : resolved.fileName());
        }

        return new DownloadTarget(uri, downloadName(uri, uri));
    }

    private String queryParameter(URI uri, String name) {
        if (!StringUtils.hasText(uri.getRawQuery())) return null;
        for (String item : uri.getRawQuery().split("&")) {
            int separator = item.indexOf('=');
            if (separator > 0 && name.equals(item.substring(0, separator))) {
                return URLDecoder.decode(item.substring(separator + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private String downloadName(URI wrapper, URI origin) {
        String fileName = queryParameter(wrapper, "fileName");
        String extension = queryParameter(wrapper, "extension");
        if (StringUtils.hasText(fileName)) {
            return StringUtils.hasText(extension) && !fileName.endsWith("." + extension)
                    ? fileName + "." + extension : fileName;
        }
        String path = origin.getPath();
        if (StringUtils.hasText(path)) {
            int slash = path.lastIndexOf('/');
            String candidate = slash >= 0 ? path.substring(slash + 1) : path;
            if (StringUtils.hasText(candidate) && candidate.contains(".")) return candidate;
        }
        return "media-download";
    }

    private String safeDownloadName(String value, String key) {
        String fallback = "media-" + key.replaceAll("[^a-zA-Z0-9_-]", "");
        String safe = StringUtils.hasText(value) ? value : fallback;
        safe = safe.replaceAll("[\\r\\n\\\\/\";]", "_").trim();
        return StringUtils.hasText(safe) ? safe : fallback;
    }

    private record DownloadTarget(URI uri, String fileName) {
    }

    private String mediaDestination(HttpServletRequest request, boolean download) {
        String destination = request.getHeader("Sec-Fetch-Dest");
        if ("audio".equalsIgnoreCase(destination) || "video".equalsIgnoreCase(destination)) {
            return destination.toLowerCase();
        }
        return download ? "empty" : "video";
    }

    private String downloadDestination(DownloadTarget target) {
        String name = Objects.toString(target.fileName(), "").toLowerCase();
        String path = Objects.toString(target.uri().getPath(), "").toLowerCase();
        return name.matches(".*\\.(mp3|m4a|aac|wav|flac|ogg|opus)$")
                || path.matches(".*\\.(mp3|m4a|aac|wav|flac|ogg|opus)$") ? "audio" : "video";
    }

    private void mediaError(HttpServletResponse response, HttpStatus status, String message) {
        byte[] payload = ("{\"code\":" + status.value() + ",\"message\":\"" + message + "\"}")
                .getBytes(StandardCharsets.UTF_8);
        try {
            response.setStatus(status.value());
            response.setContentType("application/json;charset=UTF-8");
            response.setContentLength(payload.length);
            response.getOutputStream().write(payload);
        } catch (Exception exception) {
            logger.error("[frontendPageData] failed to write media error", exception);
        }
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
