package com.koala.web.service;

import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.CdnServiceGenerator;
import com.koala.web.HostManager;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;

/** Generates direct video-middleware URLs so application nodes never carry media traffic. */
@Service
public class CdnResourceProxyService {

    @Resource
    private HostManager hostManager;

    @Resource(name = "RedisService")
    private RedisService redisService;

    public String mediaUrl(String originUrl, String referer) {
        return build(originUrl, referer, null, null, false);
    }

    public String downloadUrl(String originUrl, String referer, String fileName, String extension) {
        return build(originUrl, referer, fileName, extension, true);
    }

    public void redirect(HttpServletResponse response, String cdnUrl) throws IOException {
        if (!StringUtils.hasText(cdnUrl)) {
            response.sendError(HttpServletResponse.SC_BAD_GATEWAY, "CDN_PROXY_URL_UNAVAILABLE");
            return;
        }
        response.setStatus(HttpServletResponse.SC_TEMPORARY_REDIRECT);
        response.setHeader(HttpHeaders.LOCATION, cdnUrl);
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }

    private String build(String originUrl,
                         String referer,
                         String fileName,
                         String extension,
                         boolean download) {
        String cdnHost = hostManager.getCdnHost();
        return CdnServiceGenerator.getCdnService(
                originUrl,
                hostManager.getHost(),
                cdnHost,
                true,
                referer,
                fileName,
                extension,
                download,
                null,
                true,
                false,
                redisService);
    }
}
