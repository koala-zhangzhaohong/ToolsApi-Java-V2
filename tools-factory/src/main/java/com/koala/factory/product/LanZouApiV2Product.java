package com.koala.factory.product;

import com.koala.data.models.lanzou.LanZouAcwRespModel;
import com.koala.service.utils.*;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;

import java.io.IOException;
import java.net.URISyntaxException;
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
    private String host = "https://www.lanzou.com";
    @Setter
    private String password;
    private String htmlData;
    private ArrayList<String> htmlCookies = new ArrayList<>();
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
        try {
            int mode = 0;
            if (!ObjectUtils.isEmpty(this.id)) {
                initHtmlData(mode);
            }
            if (ObjectUtils.isEmpty(this.htmlData)) {
                mode++;
                initHtmlData(mode);
            }
        } catch (Exception e) {
            logger.error(e.toString());
        }
    }

    private void initHtmlData(int mode) throws IOException, URISyntaxException {
        restTemplateUtils = new RestTemplateUtils();
        for (String currentHost : HOST_LIST) {
            String url = currentHost + (mode == 0 ? "/" : "/tp/") + this.id;
            ResponseEntity<String> responseEntity = restTemplateUtils.get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()), String.class);
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
            reloadHtmlData();
            getFileInfo();
            break;
        }
    }

    private void reloadHtmlData() {
        if (ObjectUtils.isEmpty(this.htmlData)) {
            return;
        }
        String redirectPath = PatternUtil.matchData("<div class=\"mh\"><a href=\"(.*?)\" id=\"downurl\">", this.htmlData);
        String url = this.host + redirectPath;
        ResponseEntity<String> responseEntity = restTemplateUtils.get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()), String.class);
        String response = responseEntity.getBody();
        if (ObjectUtils.isEmpty(response)) {
            return;
        }
        List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
        logger.info("[LanZouApiProduct]({}) redirect html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
        this.htmlData = response;
        this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
    }

    private void checkAcw(int mode) {
        boolean acwStatus = false;
        if (ObjectUtils.isEmpty(this.htmlData)) {
            return;
        }
        String arg1 = PatternUtil.matchData("var arg1='(.*?)'", this.htmlData);
        Map<String, String> params = new HashMap<>();
        params.put("arg1", arg1);
        if (ObjectUtils.isEmpty(arg1))
            return;
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
            ResponseEntity<String> responseEntity = restTemplateUtils.get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()), String.class);
            String response = responseEntity.getBody();
            if (ObjectUtils.isEmpty(response)) {
                return;
            }
            List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
            this.htmlData = response;
            this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
            logger.info("[LanZouApiProduct]({}) reLoad with acw, html: {}", id, response);
        }
        logger.info("[LanZouApiProduct]({}) arg1: {}, resp: {}", id, arg1, GsonUtil.toString(acwResp));
    }

    private void getFileInfo() {
        if (ObjectUtils.isEmpty(this.htmlData)) {
            return;
        }
        String sign1 = PatternUtil.matchData("'sign':'(.*?)'", this.htmlData);
        String sign2 = PatternUtil.matchData("var postsign = '(.*?)';", this.htmlData);
        String sign3 = PatternUtil.matchData("var vidksek = '(.*?)';", this.htmlData);
        String sign = !ObjectUtils.isEmpty(sign1) && !sign1.equals("c") ? sign1.trim() : !ObjectUtils.isEmpty(sign2) && !sign2.equals("c") ? sign2.trim() : !ObjectUtils.isEmpty(sign3) && !sign3.equals("c") ? sign3.trim() : "";
        String kdns = PatternUtil.matchData("var kdns =(.*?);", this.htmlData);
        String infoPath = PatternUtil.matchData("url : '(.*?)',", this.htmlData);
        HashMap<String, String> params = new HashMap<>(0);
        params.put("action", "downprocess");
        params.put("signs", "?ctdf");
        params.put("sign", sign);
        params.put("p", password);
        params.put("kd", kdns);
        try {
            String tmp = HttpClientUtil.doPost(this.host + (!ObjectUtils.isEmpty(infoPath) ? infoPath : "/ajaxm.php"), HeaderUtil.getLanZouInfoHeader(this.host + "/" + this.id, getCookiesStr()), params);
            logger.info("[LanZouApiProduct]({}) get file info, html: {}", id, tmp);
        } catch (Exception e) {
            e.printStackTrace();
        }
        try {
            String response = restTemplateUtils.doPost(this.host + (!ObjectUtils.isEmpty(infoPath) ? infoPath : "/ajaxm.php"), params, HeaderUtil.getLanZouInfoHeader(this.host + "/" + this.id, getCookiesStr()));
            logger.info("[LanZouApiProduct]({}) get file info, html: {}", id, response);
        } catch (Exception e) {
            e.printStackTrace();
        }
        generateDownloadPathData();
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

    private HashMap<String, String> generateDownloadPathData() {
        HashMap<String, String> downloadData = new HashMap<>();
        StringBuilder fileUrl = new StringBuilder();
        if (!ObjectUtils.isEmpty(this.htmlData)) {
            String method = PatternUtil.matchData("submit.href\\ =\\ ([^\\n]*)", this.htmlData);
            if (method != null) {
                String[] prefixList = method.split("\\+");
                for (int index = 0; index < prefixList.length; index++) {
                    String tmp = PatternUtil.matchData("var\\ " + prefixList[index].trim() + "\\ =\\ '(.*?)';", this.htmlData);
                    if (index == 0) {
                        downloadData.put("host", tmp != null && tmp.isEmpty() ? null : tmp);
                    }
                    if (tmp != null && !tmp.isEmpty()) {
                        fileUrl.append(tmp);
                    }
                }
                String path = fileUrl.toString();
                path = path.replaceFirst(downloadData.get("host").isEmpty() ? "" : downloadData.get("host"), "");
                downloadData.put("path", path.isEmpty() ? null : path);
                downloadData.put("url", fileUrl.toString());
            }
            logger.info("[LanZouApiProduct]({}) method: {}, fileUrl: {}", id, method, fileUrl);
        }
        return downloadData;
    }

    private String getCookiesStr() {
        StringBuilder cookies = new StringBuilder();
        for (String cookie : this.htmlCookies) {
            cookies.append(" ").append(cookie.split(";")[0]).append(";");
        }
        cookies.append(" codelen=1; pc_ad1=1;");
        return cookies.toString().trim();
    }
}
