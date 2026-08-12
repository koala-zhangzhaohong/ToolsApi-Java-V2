package com.koala.service.utils;

import com.koala.service.data.redis.service.RedisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URLEncoder;
import java.net.URI;
import java.nio.charset.StandardCharsets;

@SuppressWarnings("ALL")
public class CdnServiceGenerator {

    private static final Logger logger = LoggerFactory.getLogger(CdnServiceGenerator.class);

    private final static Long EXPIRE_TIME = 3 * 24 * 60 * 60L;

    private final static String env = "prod";

    public static String getCdnService(String url, String host, String cdnHost, Boolean addReferer, String referer, String fileName, String extension, Boolean isDownload, Integer port, Boolean isHttps, Boolean toShortUrl, RedisService redisService) {
        String inputHost = getRegHost(url);
        if (inputHost == null || cdnHost == null) {
            logger.info("[cdnService] generate failed, url: {}, cdnHost: {}", url, cdnHost);
            return null;
        }
        String inputPath = url.substring(inputHost.length());
        StringBuilder cdnPath = new StringBuilder();
        String normalizedCdnHost = cdnHost.replaceAll("/+$", "");
        if (!env.equals("test")) {
            if (Boolean.TRUE.equals(isHttps)) {
                cdnPath.append(normalizedCdnHost.replaceFirst("^http://", "https://"));
            } else {
                if (port != null) {
                    cdnPath.append(normalizedCdnHost).append(":").append(port);
                } else {
                    cdnPath.append(normalizedCdnHost);
                }
            }
            cdnPath.append("/");
            if (Boolean.TRUE.equals(isHttps)) {
                cdnPath.append("proxy/");
            }
        } else {
            cdnPath.append("http://127.0.0.1:3000").append("/");
        }
        boolean hasParam = false;
        cdnPath.append("doProxy").append("?");
        if (addReferer != null) {
            hasParam = true;
            cdnPath.append("addReferer=").append(addReferer);
        }
        if (referer != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("referer=").append(URLEncoder.encode(referer, StandardCharsets.UTF_8));
        }
        if (fileName != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("fileName=").append(URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        }
        if (extension != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("extension=").append(URLEncoder.encode(extension, StandardCharsets.UTF_8));
        }
        if (isDownload != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("isDownload=").append(isDownload);
        }
        if (inputHost != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("host=").append(URLEncoder.encode(inputHost, StandardCharsets.UTF_8));
        } else {
            logger.info("[cdnService] generate failed: {}, reason: {}", cdnPath, "host is null");
            return null;
        }
        if (inputPath != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("path=").append(URLEncoder.encode(inputPath, StandardCharsets.UTF_8));
        } else {
            logger.info("[cdnService] generate failed: {}, reason: {}", cdnPath, "path is null");
            return null;
        }
        logger.info("[cdnService] generate success: {}", cdnPath);
        if (Boolean.TRUE.equals(toShortUrl)) {
            return ShortKeyGenerator.generateShortUrl(cdnPath.toString(), EXPIRE_TIME, host, redisService).getUrl();
        } else {
            return cdnPath.toString();
        }
    }

    public static String getRegHost(String url) {
        try {
            URI uri = URI.create(url);
            if (uri.getScheme() == null || uri.getRawAuthority() == null) {
                return null;
            }
            return uri.getScheme() + "://" + uri.getRawAuthority();
        } catch (IllegalArgumentException exception) {
            logger.warn("[cdnService] invalid origin url: {}", url);
            return null;
        }
    }

}
