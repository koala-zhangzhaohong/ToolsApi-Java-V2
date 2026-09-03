package com.koala.factory.service.netease.impl;

import cn.hutool.json.JSONObject;
import com.koala.base.module.*;
import com.koala.factory.service.netease.BaseService;
import com.koala.service.utils.CookieUtil;
import com.koala.service.utils.CryptoUtil;
import com.koala.service.utils.HttpClientUtil;
import com.koala.service.utils.IpUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@AllArgsConstructor
public class BaseServiceImpl implements BaseService {

    private final InitModule initModule;
    private final CookieUtil cookieUtil;

    @Override
    public ResponseEntity<String> doRequest(HttpServletRequest request) {
        Map<String, String> cookies = cookieUtil.getCookies(request);
        Map<String,String> queryMap = new ConcurrentHashMap<>();
        if (StringUtils.hasLength(request.getQueryString())) {
            String[] queryArray = request.getQueryString().split("&");
            for (String query : queryArray) {
                if (query.contains("=")) {
                    String[] split = query.split("=");
                    queryMap.put(split[0],split[1]);
                }
            }
        }
        String key = request.getRequestURI()
                .replaceAll("tools","")
                .replaceAll("Netease","")
                .replaceAll("/", "");

        JSONObject object = new JSONObject();
        object.set("csrf_token", cookies.get("__csrf"));
        BaseModule baseModule = initModule.getService(key);
        baseModule.execute(object,queryMap,cookies);
        try {
            Map<String, String> headers = requestHeaders(cookies);
            HttpClientUtil.HttpResult result;
            if (baseModule instanceof BaseModuleEApi) {
                String param = CryptoUtil.eapiEncrypt(baseModule.getOptionsUrl(), object.toString());
                result = HttpClientUtil.postFormResponse(
                        baseModule.getUrl().replaceAll("/api", "/" + baseModule.getType()),
                        headers,
                        Map.of("params", param));
            } else if (baseModule instanceof BaseModuleWeApi) {
                String[] encrypt = CryptoUtil.weapiEncrypt(object.toString());
                result = HttpClientUtil.postFormResponse(
                        baseModule.getUrl().replaceAll("/api", "/" + baseModule.getType()) + "?csrf_token=" + cookies.get("__csrf"),
                        headers,
                        Map.of("params", encrypt[0], "encSecKey", encrypt[1]));
            } else if (baseModule instanceof BaseModuleGetType) {
                result = HttpClientUtil.getResponse(baseModule.getUrl(), headers, null);
            } else {
                result = HttpClientUtil.postFormResponse(baseModule.getUrl(), headers, object);
            }
            return responseEntity(result);
        } catch (Exception exception) {
            log.error("Netease request failed: {}", baseModule.getUrl(), exception);
            return ResponseEntity.status(502).body("{\"code\":502,\"message\":\"UPSTREAM_REQUEST_ERROR\"}");
        }
    }

    private Map<String, String> requestHeaders(Map<String, String> cookies) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put(HttpHeaders.ACCEPT, "*/*");
        headers.put(HttpHeaders.ACCEPT_LANGUAGE, "zh-CN,zh;q=0.8,gl;q=0.6,zh-TW;q=0.4");
        headers.put(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
        headers.put(HttpHeaders.REFERER, "https://music.163.com");
        headers.put(HttpHeaders.HOST, "music.163.com");
        headers.put(HttpHeaders.COOKIE, cookies.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(java.util.stream.Collectors.joining("; ")));
        headers.put(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");
        headers.put("X-FORWARDED-FOR", IpUtil.getRandomIpAddress());
        headers.put("CLIENT-IP", IpUtil.getRandomIpAddress());
        return headers;
    }

    private ResponseEntity<String> responseEntity(HttpClientUtil.HttpResult result) {
        HttpHeaders headers = new HttpHeaders();
        result.headers().forEach(headers::put);
        return ResponseEntity.status(result.statusCode()).headers(headers).body(result.body());
    }
}
