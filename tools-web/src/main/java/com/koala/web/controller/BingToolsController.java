package com.koala.web.controller;

import com.koala.data.models.bing.BingImageDataInfoModel;
import com.koala.service.custom.http.annotation.HttpRequestRecorder;
import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.BingUtils;
import com.koala.service.utils.CdnServiceGenerator;
import com.koala.web.HostManager;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URISyntaxException;

import static com.koala.base.enums.BingResponseEnums.*;
import static com.koala.service.utils.RespUtil.formatRespData;

@RestController
@RequestMapping("tools/Bing")
public class BingToolsController {

    @Resource
    private HostManager hostManager;

    @Resource(name = "RedisService")
    private RedisService redisService;

    private final RedirectStrategy redirectStrategy = new DefaultRedirectStrategy();

    @HttpRequestRecorder
    @GetMapping("get/img")
    public String getImg(@RequestParam(required = false, defaultValue = "false") Boolean isDirect, @RequestParam(required = false) String type, HttpServletRequest request, HttpServletResponse response) throws IOException, URISyntaxException {
        BingImageDataInfoModel info = new BingImageDataInfoModel();
        String url = new BingUtils().getImage(null, redisService);
        if (ObjectUtils.isEmpty(url)) {
            return formatRespData(GET_INFO_ERROR, null);
        }
        info.setUrl(url);
        StringBuilder cdnHostPrefix = new StringBuilder(hostManager.getCdnHost());
        cdnHostPrefix.deleteCharAt(cdnHostPrefix.length() - 1);
        info.setCdnUrl(
                CdnServiceGenerator.getCdnService(
                        url,
                        hostManager.getHost(),
                        cdnHostPrefix.toString(),
                        true,
                        null,
                        null,
                        null,
                        null,
                        true,
                        true,
                        redisService

                )
        );
        if (isDirect == true) {
            switch (type) {
                case "origin":
                    redirectStrategy.sendRedirect(request, response, info.getUrl());
                    break;
                case "cdn":
                    redirectStrategy.sendRedirect(request, response, info.getCdnUrl());
                    break;
            }
        }
        return formatRespData(GET_DATA_SUCCESS, info);
    }

}
