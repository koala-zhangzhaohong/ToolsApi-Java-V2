package com.koala.web.controller;

import com.koala.base.enums.LanZouResponseEnums;
import com.koala.base.enums.LanZouTypeEnums;
import com.koala.data.models.file.FileInfoModel;
import com.koala.factory.builder.ConcreteLanZouApiV2Builder;
import com.koala.factory.builder.LanZouApiV2Builder;
import com.koala.factory.director.LanZouApiV2Manager;
import com.koala.factory.product.LanZouApiV2Product;
import com.koala.service.data.redis.service.RedisService;
import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.utils.Base64Utils;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.HeaderUtil;
import com.koala.service.utils.HttpClientUtil;
import com.koala.service.utils.ShortKeyGenerator;
import com.koala.web.service.CdnResourceProxyService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.core5.net.URIBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static com.koala.service.data.redis.RedisKeyPrefix.LANZOU_DOWNLOAD_KEY_PREFIX;
import static com.koala.service.data.redis.RedisKeyPrefix.SHORT_KEY_PREFIX;

import static com.koala.service.utils.RespUtil.formatRespData;
import static com.koala.service.utils.RespUtil.formatRespDataWithCustomMsg;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/11 16:30
 * @description
 */
@RestController
@RequestMapping("tools/LanZou")
public class LanZouToolsController {

    private static final Logger logger = LoggerFactory.getLogger(LanZouToolsController.class);

    private static final String LANZOU = "lanzou";
    private static final long DOWNLOAD_EXPIRE_SECONDS = 12 * 60 * 60L;

    @Resource(name = "RedisService")
    private RedisService redisService;

    @Resource
    private CdnResourceProxyService cdnResourceProxyService;

    /**
     * @param url
     * @param password
     * @param type
     * @param response
     * @return
     * @throws IOException
     * @throws URISyntaxException
     */
    @HttpRequestRecorder
    @GetMapping("api")
    public Object getLanZouInfos(@RequestParam(value = "url", required = false) String url, @RequestParam(value = "password", required = false) String password, @RequestParam(value = "type", required = false, defaultValue = "info") String type, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        logger.info("LanZouApi: params: {url={}, hasPassword={}, type={}}", url, !ObjectUtils.isEmpty(password), type);
        if (Boolean.FALSE.equals(checkLanZouUrl(url))) {
            return formatRespData(LanZouResponseEnums.INVALID_URL, null);
        }
        int typeId = LanZouTypeEnums.getTypeIdByType(type);
        if (Objects.equals(typeId, LanZouTypeEnums.INVALID_TYPE.getTypeId())) {
            return formatRespData(LanZouResponseEnums.INVALID_TYPE, null);
        }
        // 初始化product
        LanZouApiV2Builder builder = new ConcreteLanZouApiV2Builder();
        LanZouApiV2Manager manager = new LanZouApiV2Manager(builder);
        LanZouApiV2Product product = null;
        try {
            product = manager.construct(url, password);
        } catch (Exception e) {
            e.printStackTrace();
            return formatRespData(LanZouResponseEnums.FAILURE, null);
        }
        if (Objects.isNull(product.getHtmlData())) {
            return formatRespData(LanZouResponseEnums.GET_DATA_ERROR, null);
        }
        Optional<Map.Entry<Integer, String>> optional = product.checkStatus().entrySet().stream().findFirst();
        if (optional.isPresent()) {
            if (Objects.equals(optional.get().getKey(), LanZouResponseEnums.GET_FILE_WITH_PASSWORD.getCode()) && ObjectUtils.isEmpty(password)) {
                return formatRespData(LanZouResponseEnums.GET_FILE_WITH_PASSWORD, null);
            }
            if (!Objects.equals(optional.get().getKey(), LanZouResponseEnums.GET_FILE_SUCCESS.getCode()) && !Objects.equals(optional.get().getKey(), LanZouResponseEnums.GET_FILE_WITH_PASSWORD.getCode())) {
                return formatRespDataWithCustomMsg(optional.get().getKey(), optional.get().getValue(), null);
            }
            // 处理数据
            Object fileInfo = product.getInfo(product.getHtmlData());
            if (fileInfo instanceof FileInfoModel) {
                switch (Objects.requireNonNull(LanZouTypeEnums.getEnumsByType(type))) {
                    case DOWNLOAD:
                        FileInfoModel downloadFile = (FileInfoModel) fileInfo;
                        String downloadUrl = product.resolveDownloadUrl(downloadFile);
                        if (ObjectUtils.isEmpty(downloadUrl)) {
                            return formatRespData(LanZouResponseEnums.FAILURE, fileInfo);
                        }
                        cdnResourceProxyService.redirect(response,
                                cdnResourceProxyService.downloadUrl(
                                        downloadUrl,
                                        relayReferer(product.getDownloadRelayHeaders()),
                                        downloadFileName(downloadFile.getFileName()),
                                        downloadExtension(downloadFile.getFileName())));
                        return null;
                    case INFO:
                        return formatRespData(LanZouResponseEnums.GET_FILE_SUCCESS, fileInfo);
                    default:
                        return formatRespData(LanZouResponseEnums.INVALID_TYPE, null);
                }
            } else if (fileInfo instanceof ArrayList<?>) {
                return formatRespData(LanZouResponseEnums.GET_FILE_SUCCESS, fileInfo);
            } else {
                return formatRespData(LanZouResponseEnums.GET_FILE_ERROR_WITH_PASSWORD, null);
            }
        }
        return formatRespData(LanZouResponseEnums.FAILURE, null);
    }

    @GetMapping("download-url")
    public Object createDownloadUrl(@RequestParam String url,
                                    @RequestParam(required = false) String password,
                                    @RequestParam(required = false) String fileName,
                                    @RequestParam(required = false) String downloadHost,
                                    @RequestParam(required = false) String downloadPath,
                                    @RequestParam(required = false) String downloadUrl,
                                    @RequestParam(required = false) String redirectUrl,
                                    @RequestParam(required = false, defaultValue = "false") boolean folder) {
        if (Boolean.FALSE.equals(checkLanZouUrl(url))) {
            return formatRespData(LanZouResponseEnums.INVALID_URL, null);
        }
        try {
            boolean resolvedFolderItem = folder && hasResolvedFileData(downloadHost, downloadPath, downloadUrl, redirectUrl);
            LanZouApiV2Product product = resolvedFolderItem ? new LanZouApiV2Product() : constructProduct(url, password);
            FileInfoModel file;
            if (resolvedFolderItem) {
                if (!isLanZouDownloadMetadata(downloadHost, downloadUrl, redirectUrl)) {
                    return formatRespData(LanZouResponseEnums.INVALID_URL, null);
                }
                file = new FileInfoModel();
                file.setFileName(fileName);
                file.setDownloadHost(downloadHost);
                file.setDownloadPath(downloadPath);
                file.setDownloadUrl(downloadUrl);
                file.setRedirectUrl(redirectUrl);
            } else {
                if (Objects.isNull(product.getHtmlData())) {
                    return formatRespData(LanZouResponseEnums.GET_DATA_ERROR, null);
                }
                Optional<Map.Entry<Integer, String>> status = product.checkStatus().entrySet().stream().findFirst();
                if (status.isPresent()
                        && !Objects.equals(status.get().getKey(), LanZouResponseEnums.GET_FILE_SUCCESS.getCode())
                        && !Objects.equals(status.get().getKey(), LanZouResponseEnums.GET_FILE_WITH_PASSWORD.getCode())) {
                    return formatRespDataWithCustomMsg(status.get().getKey(), status.get().getValue(), null);
                }
                file = selectDownloadFile(product.getInfo(product.getHtmlData()), fileName);
            }
            if (file == null) {
                return formatRespData(LanZouResponseEnums.GET_FILE_ERROR_WITH_PASSWORD, null);
            }
            String targetUrl = product.resolveDownloadUrl(file);
            if (ObjectUtils.isEmpty(targetUrl) || !isHttpUrl(targetUrl)) {
                return formatRespData(LanZouResponseEnums.FAILURE, null);
            }

            String key = ShortKeyGenerator.getKey(null);
            LanZouDownloadTarget target = new LanZouDownloadTarget(
                    targetUrl, file.getFileName(), product.getDownloadRelayHeaders() == null
                            ? HeaderUtil.getMediaRelayHeader(targetUrl, "empty")
                            : product.getDownloadRelayHeaders());
            redisService.set(LANZOU_DOWNLOAD_KEY_PREFIX + key, GsonUtil.toString(target), DOWNLOAD_EXPIRE_SECONDS);
            // Also register the origin in the common short-link store so all download
            // entrances share the same expiry and can be inspected consistently.
            redisService.set(SHORT_KEY_PREFIX + key, targetUrl, DOWNLOAD_EXPIRE_SECONDS);
            String encodedKey = Base64Utils.encodeToUrlSafeString(key.getBytes(StandardCharsets.UTF_8));
            String cdnDownloadUrl = cdnResourceProxyService.downloadUrl(
                    withUpstreamFileName(targetUrl, target.fileName()),
                    relayReferer(target.headers()),
                    target.fileName(),
                    null);
            if (ObjectUtils.isEmpty(cdnDownloadUrl)) {
                return formatRespData(LanZouResponseEnums.FAILURE, null);
            }
            // The Lanzou origin occasionally closes large folder-item responses before
            // sending the body. Relay the already resolved CDN URL through our named
            // endpoint instead, while retaining the real filename in Content-Disposition.
            LanZouDownloadTarget relayTarget = new LanZouDownloadTarget(
                    cdnDownloadUrl, target.fileName(), Map.of());
            redisService.set(LANZOU_DOWNLOAD_KEY_PREFIX + key,
                    GsonUtil.toString(relayTarget), DOWNLOAD_EXPIRE_SECONDS);
            // Always use the same-origin named relay. The public CDN honors Range,
            // but its upstream Content-Disposition can override our fileName query
            // for folder items. The relay stores the CDN as its data source and only
            // replaces Content-Disposition with the parsed Lanzou filename.
            // Folder downloads go directly to the CDN. This is the only reliable way
            // to make a third-party download manager's Pause/Cancel stop traffic
            // immediately: the Java application is no longer in the data path.
            // Both single-file and folder-item downloads must leave the application
            // data path. Java only resolves and signs the target; CDN handles bytes,
            // Range requests, pause, resume and cancellation.
            String publicDownloadUrl = cdnDownloadUrl;
            return formatRespData(LanZouResponseEnums.GET_FILE_SUCCESS,
                    Map.of(
                            "downloadUrl", publicDownloadUrl,
                            "cdnDownloadUrl", cdnDownloadUrl,
                            "fallbackDownloadUrl", "/tools/LanZou/download?key=" + encodedKey));
        } catch (Exception exception) {
            logger.error("LanZou download registration failed: url={}, fileName={}", url, fileName, exception);
            return formatRespData(LanZouResponseEnums.FAILURE, null);
        }
    }

    @GetMapping("download")
    public void download(@RequestParam String key,
                         HttpServletRequest request,
                         HttpServletResponse response) {
        String decodedKey = new String(Base64Utils.decodeFromUrlSafeString(key), StandardCharsets.UTF_8);
        String stored = redisService.get(LANZOU_DOWNLOAD_KEY_PREFIX + decodedKey);
        if (ObjectUtils.isEmpty(stored)) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        try {
            LanZouDownloadTarget target = GsonUtil.toBean(stored, LanZouDownloadTarget.class);
            if (target == null || !isHttpUrl(target.url())) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                return;
            }
            String actualName = Optional.ofNullable(target.fileName()).map(String::trim)
                    .filter(name -> !name.isBlank()).orElse("lanzou-download");
            String encodedName = URLEncoder.encode(actualName, StandardCharsets.UTF_8).replace("+", "%20");
            Map<String, String> responseHeaders = Map.of(
                    "Content-Disposition", "attachment; filename*=UTF-8''" + encodedName,
                    "X-Content-Type-Options", "nosniff");
            HttpClientUtil.doRelay(target.url(), target.headers(), null, null,
                    responseHeaders, request, response, 512L * 1024);
        } catch (Exception exception) {
            logger.error("LanZou registered download failed: key={}", decodedKey, exception);
            if (!response.isCommitted()) response.setStatus(HttpServletResponse.SC_BAD_GATEWAY);
        }
    }

    @GetMapping("download-file/{fileName:.+}")
    public void redirectNamedDownload(@PathVariable String fileName,
                                      @RequestParam String key,
                                      HttpServletRequest request,
                                      HttpServletResponse response) throws IOException {
        String decodedKey = new String(Base64Utils.decodeFromUrlSafeString(key), StandardCharsets.UTF_8);
        String stored = redisService.get(LANZOU_DOWNLOAD_KEY_PREFIX + decodedKey);
        LanZouDownloadTarget target = GsonUtil.toBean(stored, LanZouDownloadTarget.class);
        if (target == null || !isHttpUrl(target.url())) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        String actualName = Optional.ofNullable(target.fileName()).map(String::trim)
                .filter(name -> !name.isBlank()).orElse(fileName);
        String encodedName = URLEncoder.encode(actualName, StandardCharsets.UTF_8).replace("+", "%20");
        Map<String, String> responseHeaders = Map.of(
                "Content-Disposition", "attachment; filename*=UTF-8''" + encodedName,
                "X-Content-Type-Options", "nosniff",
                "Cache-Control", "no-store");
        try {
            HttpClientUtil.doRelay(target.url(), target.headers(), null, null,
                    responseHeaders, request, response, 512L * 1024);
        } catch (URISyntaxException exception) {
            if (!response.isCommitted()) response.sendError(HttpServletResponse.SC_BAD_GATEWAY);
        }
    }

    private LanZouApiV2Product constructProduct(String url, String password) throws Exception {
        LanZouApiV2Builder builder = new ConcreteLanZouApiV2Builder();
        return new LanZouApiV2Manager(builder).construct(url, password);
    }

    private String relayReferer(Map<String, String> headers) {
        return headers == null ? null : headers.get("Referer");
    }

    private String withUpstreamFileName(String url, String fileName) throws URISyntaxException {
        if (!org.springframework.util.StringUtils.hasText(fileName)) return url;
        // Lanzou's final storage URL already contains a fileName query parameter and
        // uses it for Content-Disposition. Replace that value before handing the URL
        // to the CDN, otherwise the origin overrides the proxy's requested filename.
        return new URIBuilder(url).setParameter("fileName", fileName.trim()).build().toString();
    }

    private String encodedPathSegment(String fileName) {
        String actualName = Optional.ofNullable(fileName).map(String::trim)
                .filter(name -> !name.isBlank()).orElse("lanzou-download");
        return URLEncoder.encode(actualName, StandardCharsets.UTF_8).replace("+", "%20")
                .replace("%2F", "_").replace("%5C", "_");
    }

    private String downloadFileName(String fullName) {
        String safeName = Optional.ofNullable(fullName).map(String::trim)
                .filter(name -> !name.isBlank()).orElse("lanzou-download");
        int separator = safeName.lastIndexOf('.');
        return separator > 0 ? safeName.substring(0, separator) : safeName;
    }

    private String downloadExtension(String fullName) {
        if (fullName == null) return null;
        String safeName = fullName.trim();
        int separator = safeName.lastIndexOf('.');
        return separator > 0 && separator < safeName.length() - 1
                ? safeName.substring(separator + 1) : null;
    }

    private FileInfoModel selectDownloadFile(Object info, String fileName) {
        if (info instanceof FileInfoModel file) return file;
        if (!(info instanceof ArrayList<?> files)) return null;
        return files.stream()
                .filter(FileInfoModel.class::isInstance)
                .map(FileInfoModel.class::cast)
                .filter(file -> !org.springframework.util.StringUtils.hasText(fileName)
                        || Objects.equals(file.getFileName(), fileName))
                .findFirst()
                .orElse(null);
    }

    private boolean hasResolvedFileData(String downloadHost, String downloadPath,
                                        String downloadUrl, String redirectUrl) {
        return org.springframework.util.StringUtils.hasText(downloadUrl)
                || org.springframework.util.StringUtils.hasText(redirectUrl)
                || (org.springframework.util.StringUtils.hasText(downloadHost)
                && org.springframework.util.StringUtils.hasText(downloadPath));
    }

    private boolean isLanZouDownloadMetadata(String downloadHost, String downloadUrl, String redirectUrl) {
        // Folder metadata must originate from a Lanzou verification host. Direct URLs
        // are accepted only when the accompanying verification host is also present.
        if (org.springframework.util.StringUtils.hasText(downloadHost)) {
            try {
                return isLanZouHost(URI.create(downloadHost).getHost());
            } catch (Exception ignored) {
                return false;
            }
        }
        return isLanZouUrl(downloadUrl) || isLanZouUrl(redirectUrl);
    }

    private boolean isLanZouUrl(String value) {
        if (!org.springframework.util.StringUtils.hasText(value)) return false;
        try {
            String host = URI.create(value).getHost();
            return host != null && isLanZouHost(host);
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isLanZouHost(String host) {
        if (host == null) return false;
        String normalized = host.toLowerCase();
        return normalized.contains(LANZOU) || normalized.equals("lanrar.com")
                || normalized.endsWith(".lanrar.com");
    }

    private boolean isHttpUrl(String value) {
        try {
            URI uri = URI.create(value);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && org.springframework.util.StringUtils.hasText(uri.getHost());
        } catch (Exception ignored) {
            return false;
        }
    }

    private record LanZouDownloadTarget(String url, String fileName, Map<String, String> headers) {
    }

    private Boolean checkLanZouUrl(String url) {
        return !Objects.isNull(url) && url.contains(LANZOU);
    }
}
