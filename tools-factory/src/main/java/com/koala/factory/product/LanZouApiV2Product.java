package com.koala.factory.product;

import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.RestTemplateUtils;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;
import org.springframework.web.client.RestTemplate;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static com.koala.base.enums.LanZouResponseEnums.GET_FILE_SUCCESS;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:08
 * @description
 */
public class LanZouApiV2Product {
    private static final Logger logger = LoggerFactory.getLogger(LanZouApiV2Product.class);
    private String id;
    @Setter
    private String url;
    private String host;
    @Setter
    private String password;
    private String htmlData;
    private ArrayList<String> htmlCookies;
    private static final ArrayList<String> HOST_LIST = new ArrayList<>();
    private static final HashMap<Integer, List<String>> INVALID_LIST = new HashMap<>();
    @Setter
    private RestTemplate restTemplate;
    private RestTemplateUtils restTemplateUtils;

    static {
        HOST_LIST.add("https://wwwx.lanzoux.com");
        HOST_LIST.add("https://www.lanzoui.com");
        HOST_LIST.add("https://www.lanzouw.com");
        HOST_LIST.add("https://wwx.lanzouj.com");
        HOST_LIST.add("https://wwi.lanzouj.com");
        HOST_LIST.add("https://wwtr.lanzoue.com");
        INVALID_LIST.put(201, Arrays.asList("文件取消分享了", "文件不存在", "访问地址错误，请核查"));
        INVALID_LIST.put(202, List.of("输入密码"));
    }

    public void getIdByUrl() {
        if (!ObjectUtils.isEmpty(this.url)) {
            String rule = "com/";
            this.id = this.url.substring(this.url.lastIndexOf(rule) + rule.length(), Objects.equals(this.url.lastIndexOf("/"), this.url.lastIndexOf(rule) + rule.length() - 1) ? this.url.length() : this.url.lastIndexOf("/"));
        }
    }

    public void init() {
        int mode = 0;
        if (!ObjectUtils.isEmpty(this.id)) {
            initHtmlData(mode);
        }
        if (ObjectUtils.isEmpty(this.htmlData)) {
            mode++;
            initHtmlData(mode);
        }
    }

    private void initHtmlData(int mode) {
        restTemplateUtils = new RestTemplateUtils();
        for (String currentHost : HOST_LIST) {
            String url = currentHost + (mode == 0 ? "/" : "/tp/") + this.id;
            ResponseEntity<String> responseEntity = restTemplateUtils.get(url, String.class);
            String response = responseEntity.getBody();
            if (ObjectUtils.isEmpty(response)) {
                continue;
            }
            List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
            logger.info("[LanZouApiProduct]({}) html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
            this.host = currentHost;
            this.htmlData = response;
            this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
            break;
        }
    }

    public Map<Integer, String> checkStatus() {
        HashMap<Integer, String> result = new HashMap<>(0);
        INVALID_LIST.forEach((key, item) -> {
            for (String value : item) {
                if (this.htmlData.contains(value)) {
                    result.put(key, value);
                    break;
                }
            }
        });
        if (result.isEmpty()) {
            result.put(GET_FILE_SUCCESS.getCode(), GET_FILE_SUCCESS.getMessage());
        }
        return result;
    }
}
