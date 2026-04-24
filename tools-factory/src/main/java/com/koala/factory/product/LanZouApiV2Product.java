package com.koala.factory.product;

import com.koala.data.models.lanzou.LanZouAcwRespModel;
import com.koala.service.utils.*;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;

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
    private String acw;
    private static final ArrayList<String> HOST_LIST = new ArrayList<>();
    private static final HashMap<Integer, List<String>> INVALID_LIST = new HashMap<>();
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
            checkAcw(mode);
            break;
        }
    }

    private void checkAcw(int mode) {
        boolean acwStatus = false;
        if (ObjectUtils.isEmpty(this.htmlData)) {
            return;
        }
        String arg1 = PatternUtil.matchData("var arg1='(.*?)'", this.htmlData);
        Map<String, String> params = new HashMap<>();
        params.put("arg1", arg1);
        LanZouAcwRespModel acwResp = restTemplateUtils.post(AcwUtils.getAcwPath(), params, LanZouAcwRespModel.class).getBody();
        if (!ObjectUtils.isEmpty(acwResp) && !ObjectUtils.isEmpty(acwResp.getData().getAcw())) {
            this.acw = acwResp.getData().getAcw();
            for (int index = 0; index < this.htmlCookies.size(); index++) {
                if (this.htmlCookies.get(index).startsWith("acw_sc__v2=")) {
                    this.htmlCookies.set(index, "acw_sc__v2=" + this.acw + ";path=/;HttpOnly;Max-Age=3600");
                    acwStatus = true;
                    break;
                }
            }
            if (!acwStatus) this.htmlCookies.add("acw_sc__v2=" + this.acw + ";path=/;HttpOnly;Max-Age=3600");
            String url = this.host + (mode == 0 ? "/" : "/tp/") + this.id;
            ResponseEntity<String> responseEntity = restTemplateUtils.get(url, HeaderUtil.getLanZouInfoHeader(host, url, getCookiesStr()), String.class);
            String response = responseEntity.getBody();
            if (ObjectUtils.isEmpty(response)) {
                return;
            }
            List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
            logger.info("[LanZouApiProduct]({}) reLoad with acw, html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
        }
        logger.info("[LanZouApiProduct]({}) arg1: {}, resp: {}", id, arg1, GsonUtil.toString(acwResp));
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

    private String getCookiesStr() {
        StringBuilder cookies = new StringBuilder();
        for (String cookie : this.htmlCookies) {
            cookies.append(" ").append(cookie.split(";")[0]).append(";");
        }
        return cookies.toString().trim();
    }
}
