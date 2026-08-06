package com.koala.factory.http;

import com.koala.service.data.redis.RedisKeyPrefix;
import com.koala.service.data.redis.service.RedisService;
import com.koala.service.utils.CryptoUtil;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.HeaderUtil;
import com.koala.service.utils.HttpClientUtil;
import org.apache.hc.client5.http.cookie.Cookie;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URISyntaxException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

import static com.koala.service.utils.HeaderUtil.getNeteaseHttpHeader;

/**
 * @author koala
 * @version 1.0
 * @date 2023/7/3 16:24
 * @description
 */
@Component
public class NeteaseHttpManager {

    private static final String BASE_URL = "http://music.163.com";
    private final RedisService redisService;

    private String csrf = null;
    private String cookieStr = null;

    public NeteaseHttpManager(RedisService redisService) {
        this.redisService = redisService;
    }

    public static Long getCurrentDate() {
        Date currentTime = new Date();
        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMdd");
        return Long.parseLong(formatter.format(currentTime));
    }

    private void newInstance() throws IOException, URISyntaxException {
        String key = RedisKeyPrefix.NETEASE_CSRF_COOKIE + getCurrentDate();
        String publicKey = RedisKeyPrefix.NETEASE_PUBLIC_COOKIE + getCurrentDate();
        List<Cookie> cookies = HttpClientUtil.doGetCookie(BASE_URL, getNeteaseHttpHeader(null), null);
        Optional<Cookie> cookie = cookies.stream().filter(item -> item.getName().equals("__csrf")).findFirst();
        cookie.ifPresent(value -> csrf = value.getValue());
        redisService.set(key, csrf, 24 * 60 * 60L);
        StringBuilder cookieString = new StringBuilder();
        cookies.forEach(item -> cookieString.append(" ").append(item.getName()).append("=").append(item.getValue()).append(";"));
        cookieStr = cookieString.toString().trim();
        redisService.set(publicKey, cookieString.toString().trim(), 24 * 60 * 60L);
    }

    public String requestWeapi(String url, LinkedHashMap<String, String> params, String customCookies) throws IOException, URISyntaxException {
        String key = RedisKeyPrefix.NETEASE_CSRF_COOKIE + getCurrentDate();
        String publicKey = RedisKeyPrefix.NETEASE_PUBLIC_COOKIE + getCurrentDate();
        String csrfToken = redisService.get(key);
        String cookie = redisService.get(publicKey);
        if (!StringUtils.hasLength(csrfToken) && !StringUtils.hasLength(cookie)) {
            newInstance();
            csrfToken = this.csrf;
            cookie = this.cookieStr;
        }
        params.put("csrf_token", csrfToken);
        String[] encrypted = CryptoUtil.weapiEncrypt(GsonUtil.toString(params));
        LinkedHashMap<String, String> bodyData = new LinkedHashMap<>();
        bodyData.put("params", encrypted[0]);
        bodyData.put("encSecKey", encrypted[1]);
        String body = GsonUtil.toString(bodyData);
        return HttpClientUtil.doPostJson(url + "?csrf_token=" + csrfToken, HeaderUtil.getNeteaseHttpHeader(cookie + customCookies), body);
    }
}
