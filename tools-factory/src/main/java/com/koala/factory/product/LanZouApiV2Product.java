package com.koala.factory.product;

import com.koala.data.models.file.FileInfoModel;
import com.koala.data.models.lanzou.FolderDataRespModel;
import com.koala.data.models.lanzou.FolderFileInfoRespModel;
import com.koala.data.models.lanzou.LanZouAcwRespModel;
import com.koala.data.models.lanzou.LanZouFileInfoRespModel;
import com.koala.service.utils.*;
import lombok.Getter;
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
    private String host = "https://www.lanzou.com";
    @Setter
    private String password;
    @Getter
    private String htmlData;
    private ArrayList<String> htmlCookies = new ArrayList<>();
    private String acw;
    private static final ArrayList<String> HOST_LIST = new ArrayList<>();
    private static final HashMap<Integer, List<String>> INVALID_LIST = new HashMap<>();
    private final RestTemplateUtils restTemplateUtils = new RestTemplateUtils();

    static {
        HOST_LIST.add("https://wwwx.lanzoux.com");
        HOST_LIST.add("https://www.lanzoui.com");
        HOST_LIST.add("https://www.lanzouw.com");
        HOST_LIST.add("https://wwx.lanzouj.com");
        HOST_LIST.add("https://wwi.lanzouj.com");
        HOST_LIST.add("https://wwtr.lanzoue.com");
        HOST_LIST.add("https://wwbgd.lanzouw.com");
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

    private void initHtmlData(int mode) {
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
            String tmpHtmlData = checkAcwAndReload(mode, this.htmlData);
            if (!ObjectUtils.isEmpty(tmpHtmlData)) {
                this.htmlData = tmpHtmlData;
            }
            String tmpReloadHtmlData = reloadHtmlData(this.htmlData);
            if (!ObjectUtils.isEmpty(tmpReloadHtmlData)) {
                this.htmlData = tmpReloadHtmlData;
            }
            break;
        }
    }

    private String reloadHtmlData(String htmlData) {
        if (ObjectUtils.isEmpty(htmlData)) {
            return null;
        }
        if (htmlData.contains("function more()")) {
            return null;
        }
        String redirectPath = PatternUtil.matchData("<div class=\"mh\"><a href=\"(.*?)\" id=\"downurl\">", htmlData);
        String url = this.host + redirectPath;
        ResponseEntity<String> responseEntity = restTemplateUtils.get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()), String.class);
        String response = responseEntity.getBody();
        if (ObjectUtils.isEmpty(response)) {
            return null;
        }
        List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
        logger.info("[LanZouApiProduct]({}) redirect html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
        this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
        return response;
    }

    private String checkAcwAndReload(int mode, String htmlData) {
        boolean acwStatus = false;
        if (ObjectUtils.isEmpty(htmlData)) {
            return null;
        }
        String arg1 = PatternUtil.matchData("var arg1='(.*?)'", htmlData);
        Map<String, String> params = new HashMap<>();
        params.put("arg1", arg1);
        if (ObjectUtils.isEmpty(arg1))
            return null;
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
                return null;
            }
            List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
            this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
            logger.info("[LanZouApiProduct]({}) reLoad with acw, html: {}", id, response);
            return response;
        }
        logger.info("[LanZouApiProduct]({}) arg1: {}, resp: {}", id, arg1, GsonUtil.toString(acwResp));
        return null;
    }

    public Object getInfo(String htmlData) {
        if (ObjectUtils.isEmpty(htmlData)) {
            return null;
        }
        if (htmlData.contains("function more()")) {
            // 文件夹
            return getMultiFileInfo(htmlData);
        } else {
            return getFileInfo(htmlData);
        }
    }

    private ArrayList<FileInfoModel> getMultiFileInfo(String htmlData) {
        String infoPath = PatternUtil.matchData("url : '(.*?)',", htmlData);
        HashMap<String, String> params = new HashMap<>(0);
        params.put("lx", PatternUtil.matchData("'lx':(.*?),", htmlData));
        params.put("fid", PatternUtil.matchData("'fid':(.*?),", htmlData));
        params.put("uid", PatternUtil.matchData("'uid':'(.*?)',", htmlData));
        params.put("pg", PatternUtil.matchData("pgs =(.*?);", htmlData));
        params.put("rep", PatternUtil.matchData("'rep':'(.*?)'", htmlData));
        params.put("t", PatternUtil.matchData("var " + PatternUtil.matchData("'t':(.*?),", htmlData) + " = '(.*?)';", htmlData));
        params.put("k", PatternUtil.matchData("var " + PatternUtil.matchData("'k':(.*?),", htmlData) + " = '(.*?)';", htmlData));
        params.put("up", PatternUtil.matchData("'up':(.*?),", htmlData));
        params.put("ls", PatternUtil.matchData("'ls':(.*?),", htmlData));
        params.put("pwd", password);
        ResponseEntity<String> responseEntity = restTemplateUtils.doPost(this.host + (!ObjectUtils.isEmpty(infoPath) ? infoPath : "/filemoreajax.php"), params, HeaderUtil.getLanZouInfoHeader(this.host + "/" + this.id, getCookiesStr()));
        String response = responseEntity.getBody();
        if (ObjectUtils.isEmpty(response)) {
            return null;
        }
        List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
        logger.info("[LanZouApiProduct]({}) get folder, html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
        FolderDataRespModel folderData = GsonUtil.toBean(response, FolderDataRespModel.class);
        if (Objects.equals(folderData.getZt(), 1)) {
            ArrayList<FileInfoModel> fileInfoList = new ArrayList<>(0);
            Object folderFileData = folderData.getText();
            if (folderFileData instanceof ArrayList) {
                ((ArrayList<?>) folderFileData).forEach(item -> {
                    try {
                        String singleFileHtmlData = getSingleFileHtmlData(0, GsonUtil.toBean(GsonUtil.toString(item), FolderFileInfoRespModel.class));
                        FileInfoModel fileInfo = getFileInfo(singleFileHtmlData);
                        fileInfoList.add(fileInfo);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
            }
            return fileInfoList;
        } else {
            return null;
        }
    }

    private String getSingleFileHtmlData(int mode, FolderFileInfoRespModel fileInfo) {
        String response = null;
        for (String currentHost : HOST_LIST) {
            String url = currentHost + (mode == 0 ? "/" : "/tp/") + fileInfo.getId();
            ResponseEntity<String> responseEntity = restTemplateUtils.get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()), String.class);
            response = responseEntity.getBody();
            if (ObjectUtils.isEmpty(response)) {
                continue;
            }
            List<String> cookies = responseEntity.getHeaders().get("Set-Cookie");
            logger.info("[LanZouApiProduct]({}) html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
            this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
            String tmpHtmlData = checkAcwAndReload(mode, response);
            if (!ObjectUtils.isEmpty(tmpHtmlData)) {
                response = tmpHtmlData;
            }
            String tmpReloadHtmlData = reloadHtmlData(response);
            if (!ObjectUtils.isEmpty(tmpReloadHtmlData)) {
                response = tmpReloadHtmlData;
            }
            break;
        }
        if (ObjectUtils.isEmpty(response) && mode < 1) {
            getSingleFileHtmlData(mode, fileInfo);
        } else if (ObjectUtils.isEmpty(response) && mode >= 1) {
            return null;
        }
        return response;
    }

    private FileInfoModel getFileInfo(String htmlData) {
        if (ObjectUtils.isEmpty(htmlData)) {
            return null;
        }
        FileInfoModel fileInfo = new FileInfoModel();
        fileInfo.setFileName(PatternUtil.matchData("<div class=\"md\">(.*?)<span class=\"mtt\">", htmlData));
        fileInfo.setFileSize(PatternUtil.matchData("<span class=\"mtt\">\\((.*?)\\)</span>", htmlData));
        String updateTime = PatternUtil.matchData("<span class=\"mt2\"></span>(.*?)<span class=\"mt2\">", htmlData);
        if (Objects.isNull(updateTime)) {
            updateTime = PatternUtil.matchData("时间:<\\/span>(.*?)<span class=\"mt2\">", htmlData);
        }
        fileInfo.setUpdateTime(updateTime);
        fileInfo.setAuthor(PatternUtil.matchData("发布者:<\\/span>(.*?)<span class=\"mt2\">", htmlData));
        HashMap<String, String> downloadInfoWithoutPassword = generateDownloadPathData(htmlData);
        if (ObjectUtils.isEmpty(this.password) || !ObjectUtils.isEmpty(downloadInfoWithoutPassword.get("url"))) {
            fileInfo.setDownloadHost(downloadInfoWithoutPassword.get("host"));
            fileInfo.setDownloadPath(downloadInfoWithoutPassword.get("path"));
            fileInfo.setDownloadUrl(downloadInfoWithoutPassword.get("url"));
            logger.info("[LanZouApiProduct]({}) get file info, info: {}", id, GsonUtil.toString(fileInfo));
            return fileInfo;
        }
        String sign1 = PatternUtil.matchData("'sign':'(.*?)'", htmlData);
        String sign2 = PatternUtil.matchData("var postsign = '(.*?)';", htmlData);
        String sign3 = PatternUtil.matchData("var vidksek = '(.*?)';", htmlData);
        String sign = !ObjectUtils.isEmpty(sign1) && !sign1.equals("c") ? sign1.trim() : !ObjectUtils.isEmpty(sign2) && !sign2.equals("c") ? sign2.trim() : !ObjectUtils.isEmpty(sign3) && !sign3.equals("c") ? sign3.trim() : "";
        String kdns = PatternUtil.matchData("var kdns =(.*?);", htmlData);
        String infoPath = PatternUtil.matchData("url : '(.*?)',", htmlData);
        HashMap<String, String> params = new HashMap<>(0);
        params.put("action", "downprocess");
        params.put("signs", "?ctdf");
        params.put("sign", sign);
        params.put("p", password);
        params.put("kd", kdns);
        ResponseEntity<String> responseEntity = restTemplateUtils.doPost(this.host + (!ObjectUtils.isEmpty(infoPath) ? infoPath : "/ajaxm.php"), params, HeaderUtil.getLanZouInfoHeader(this.host + "/" + this.id, getCookiesStr()));
        LanZouFileInfoRespModel downloadInfo = GsonUtil.toBean(responseEntity.getBody(), LanZouFileInfoRespModel.class);
        if (ObjectUtils.isEmpty(downloadInfo) || downloadInfo.getZt() == 0) {
            return null;
        }
        fileInfo.setDownloadHost(downloadInfo.getDownloadHost());
        fileInfo.setDownloadPath(downloadInfo.getDownloadPath());
        ResponseEntity<String> redirectResponseEntity = restTemplateUtils.get(downloadInfo.getDownloadHost() + "/file/" + downloadInfo.getDownloadPath(), HeaderUtil.getLanZouInfoHeader(this.url, getCookiesStr()), String.class);
        String redirectResponse = redirectResponseEntity.getBody();
        fileInfo.setDownloadUrl(PatternUtil.matchData("<a href=\"(.*?)\" class=\"d_pclink2\">", redirectResponse));
        logger.info("[LanZouApiProduct]({}) get file info, info: {}", id, GsonUtil.toString(fileInfo));
        return fileInfo;
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

    private HashMap<String, String> generateDownloadPathData(String htmlData) {
        HashMap<String, String> downloadData = new HashMap<>();
        StringBuilder fileUrl = new StringBuilder();
        if (!ObjectUtils.isEmpty(htmlData)) {
            String method = PatternUtil.matchData("submit.href\\ =\\ ([^\\n]*)", htmlData);
            if (method != null) {
                String[] prefixList = method.split("\\+");
                for (int index = 0; index < prefixList.length; index++) {
                    String tmp = PatternUtil.matchData("var\\ " + prefixList[index].trim() + "\\ =\\ '(.*?)';", htmlData);
                    if (index == 0) {
                        downloadData.put("host", tmp != null && tmp.isEmpty() ? null : tmp);
                    }
                    if (tmp != null && !tmp.isEmpty()) {
                        fileUrl.append(tmp);
                        if (index == 0) {
                            fileUrl.append("/");
                        }
                    }
                }
                String path = fileUrl.toString();
                path = path.replaceFirst(downloadData.get("host").isEmpty() ? "" : downloadData.get("host"), "");
                downloadData.put("path", path.isEmpty() ? null : path);
                downloadData.put("url", fileUrl.toString());
            }
            logger.info("[LanZouApiProduct]({}) method: {}, fileUrl: {}", id, method, !ObjectUtils.isEmpty(fileUrl) ? fileUrl : null);
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
