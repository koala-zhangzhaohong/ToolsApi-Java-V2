package com.koala.factory.product;

import com.koala.data.models.file.FileInfoModel;
import com.koala.data.models.lanzou.FolderDataRespModel;
import com.koala.data.models.lanzou.FolderFileInfoRespModel;
import com.koala.data.models.lanzou.LanZouFileInfoRespModel;
import com.koala.service.utils.*;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.ObjectUtils;

import java.net.URI;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
    private Map<String, String> downloadRelayHeaders = Map.of();
    private static final ArrayList<String> HOST_LIST = new ArrayList<>();
    private static final HashMap<Integer, List<String>> INVALID_LIST = new HashMap<>();
    private static final int FOLDER_FILE_WORKERS = 4;
    private static final String DOWNLOAD_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro Build/TQ3A.230805.001; wv) "
            + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
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
            HttpClientUtil.HttpResult responseEntity = get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()));
            String response = responseEntity.body();
            if (ObjectUtils.isEmpty(response)) {
                continue;
            }
            List<String> cookies = responseEntity.headerValues("Set-Cookie");
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
        HttpClientUtil.HttpResult responseEntity = get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()));
        String response = responseEntity.body();
        if (ObjectUtils.isEmpty(response)) {
            return null;
        }
        List<String> cookies = responseEntity.headerValues("Set-Cookie");
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
        if (ObjectUtils.isEmpty(arg1))
            return null;
        String calculatedAcw = AcwUtils.calculate(arg1);
        if (!ObjectUtils.isEmpty(calculatedAcw)) {
            this.acw = calculatedAcw;
            for (int index = 0; index < this.htmlCookies.size(); index++) {
                if (this.htmlCookies.get(index).startsWith("acw_sc__v2=")) {
                    this.htmlCookies.set(index, "acw_sc__v2=" + this.acw + ";path=/;HttpOnly;Max-Age=3600");
                    acwStatus = true;
                    break;
                }
            }
            if (!acwStatus) this.htmlCookies.add("acw_sc__v2=" + this.acw + ";path=/;HttpOnly;Max-Age=3600");
            String url = this.host + (mode == 0 ? "/" : "/tp/") + this.id;
            HttpClientUtil.HttpResult responseEntity = get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()));
            String response = responseEntity.body();
            if (ObjectUtils.isEmpty(response)) {
                return null;
            }
            List<String> cookies = responseEntity.headerValues("Set-Cookie");
            this.htmlCookies = new ArrayList<>(cookies != null ? cookies : new ArrayList<>());
            logger.info("[LanZouApiProduct]({}) reLoad with acw, html: {}", id, response);
            return response;
        }
        logger.info("[LanZouApiProduct]({}) unable to calculate acw from arg1: {}", id, arg1);
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
        HttpClientUtil.HttpResult responseEntity = post(this.host + (!ObjectUtils.isEmpty(infoPath) ? infoPath : "/filemoreajax.php"), params, HeaderUtil.getLanZouInfoHeader(this.host + "/" + this.id, getCookiesStr()));
        String response = responseEntity.body();
        if (ObjectUtils.isEmpty(response)) {
            return null;
        }
        List<String> cookies = responseEntity.headerValues("Set-Cookie");
        logger.info("[LanZouApiProduct]({}) get folder, html: {}, cookies: {}", id, response, GsonUtil.toString(cookies));
        FolderDataRespModel folderData = GsonUtil.toBean(response, FolderDataRespModel.class);
        if (Objects.equals(folderData.getZt(), 1)) {
            ArrayList<FileInfoModel> fileInfoList = new ArrayList<>(0);
            Object folderFileData = folderData.getText();
            if (folderFileData instanceof ArrayList) {
                List<FolderFileInfoRespModel> folderFiles = ((ArrayList<?>) folderFileData).stream()
                        .map(item -> GsonUtil.toBean(GsonUtil.toString(item), FolderFileInfoRespModel.class))
                        .filter(item -> !ObjectUtils.isEmpty(item.getId()))
                        .toList();
                int workerCount = Math.min(FOLDER_FILE_WORKERS, folderFiles.size());
                if (workerCount == 0) {
                    return fileInfoList;
                }
                ExecutorService executor = Executors.newFixedThreadPool(workerCount);
                try {
                    List<Callable<FileInfoModel>> tasks = folderFiles.stream()
                            .map(this::loadFolderFileInfo)
                            .toList();
                    for (Future<FileInfoModel> future : executor.invokeAll(tasks)) {
                        try {
                            FileInfoModel fileInfo = future.get();
                            if (fileInfo != null) {
                                fileInfoList.add(fileInfo);
                            }
                        } catch (Exception e) {
                            logger.warn("[LanZouApiProduct]({}) unable to load one folder file", id, e);
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    logger.warn("[LanZouApiProduct]({}) folder file loading interrupted", id);
                } finally {
                    executor.shutdownNow();
                }
            }
            return fileInfoList;
        } else {
            return null;
        }
    }

    private Callable<FileInfoModel> loadFolderFileInfo(FolderFileInfoRespModel folderFile) {
        return () -> {
            try {
                // Each file gets its own product to avoid sharing mutable cookies and ACW state across workers.
                LanZouApiV2Product fileProduct = new LanZouApiV2Product();
                fileProduct.setUrl(this.host + "/" + folderFile.getId());
                fileProduct.setPassword(this.password);
                fileProduct.getIdByUrl();
                fileProduct.init();
                return fileProduct.getInfo(fileProduct.getHtmlData()) instanceof FileInfoModel fileInfo ? fileInfo : null;
            } catch (Exception e) {
                logger.warn("[LanZouApiProduct]({}) unable to load folder file {}", id, folderFile.getId(), e);
                return null;
            }
        };
    }

    private String getSingleFileHtmlData(int mode, FolderFileInfoRespModel fileInfo) {
        String response = null;
        for (String currentHost : HOST_LIST) {
            String url = currentHost + (mode == 0 ? "/" : "/tp/") + fileInfo.getId();
            HttpClientUtil.HttpResult responseEntity = get(url, HeaderUtil.getLanZouInfoHeader(url, getCookiesStr()));
            response = responseEntity.body();
            if (ObjectUtils.isEmpty(response)) {
                continue;
            }
            List<String> cookies = responseEntity.headerValues("Set-Cookie");
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
        HttpClientUtil.HttpResult responseEntity = post(this.host + (!ObjectUtils.isEmpty(infoPath) ? infoPath : "/ajaxm.php"), params, HeaderUtil.getLanZouInfoHeader(this.host + "/" + this.id, getCookiesStr()));
        LanZouFileInfoRespModel downloadInfo = GsonUtil.toBean(responseEntity.body(), LanZouFileInfoRespModel.class);
        if (ObjectUtils.isEmpty(downloadInfo) || downloadInfo.getZt() == 0) {
            return null;
        }
        fileInfo.setDownloadHost(downloadInfo.getDownloadHost());
        fileInfo.setDownloadPath(downloadInfo.getDownloadPath());
        logger.info("[LanZouApiProduct]({}) get file info, info: {}", id, GsonUtil.toString(fileInfo));
        return fileInfo;
    }

    /**
     * Resolves the current anti-abuse download page into the real CDN URL.
     * This is intentionally deferred until download time so normal parsing and
     * folder listing do not pay the verification delay.
     */
    public String resolveDownloadUrl(FileInfoModel fileInfo) {
        if (fileInfo == null) {
            return null;
        }
        boolean hasVerificationMetadata = hasVerificationMetadata(fileInfo);
        // Folder entries commonly expose both host/path and a downloadUrl. The latter
        // is often only an anti-abuse HTML page, not the file. Whenever verification
        // metadata exists, complete that flow instead of returning the page URL early.
        if (!hasVerificationMetadata) {
            if (!ObjectUtils.isEmpty(fileInfo.getRedirectUrl())) {
                return decodeHtmlUrl(fileInfo.getRedirectUrl());
            }
            if (!ObjectUtils.isEmpty(fileInfo.getDownloadUrl())) {
                return decodeHtmlUrl(fileInfo.getDownloadUrl());
            }
            return null;
        }

        String verificationUrl = buildVerificationUrl(fileInfo.getDownloadHost(), fileInfo.getDownloadPath());
        if (ObjectUtils.isEmpty(verificationUrl)) return null;
        Map<String, String> headers = getDownloadVerificationHeaders(verificationUrl);
        HttpClientUtil.HttpResult verificationPage = getWithoutRedirects(verificationUrl, headers);
        String verificationCookies = cookieHeader(verificationPage.headerValues("Set-Cookie"));
        if (!ObjectUtils.isEmpty(verificationCookies)) {
            headers.put("Cookie", verificationCookies);
        }

        String verificationRedirect = verificationPage.firstHeader("Location");
        if (!ObjectUtils.isEmpty(verificationRedirect)) {
            String resolvedUrl = URI.create(verificationUrl).resolve(verificationRedirect).toString();
            fileInfo.setDownloadUrl(resolvedUrl);
            downloadRelayHeaders = relayHeaders(headers);
            return resolvedUrl;
        }

        // 单文件接口在部分节点会直接返回文件流（而不是验证 HTML 页面）。
        // 这类响应没有可供解析的 file/sign 参数，应保留原始 CDN 地址交给
        // 后续 relay 下载；否则会被误判为 UNKNOWN_ERROR。
        String contentType = verificationPage.firstHeader("Content-Type");
        if (verificationPage.isSuccessful() && isBinaryFileResponse(contentType, verificationPage.body())) {
            fileInfo.setDownloadUrl(verificationUrl);
            downloadRelayHeaders = relayHeaders(headers);
            return verificationUrl;
        }

        String directUrl = PatternUtil.matchData("<a href=\"(.*?)\" class=\"d_pclink2\">", verificationPage.body());
        if (!ObjectUtils.isEmpty(directUrl)) {
            directUrl = resolveDownloadAddress(verificationUrl, null, directUrl);
            fileInfo.setDownloadUrl(directUrl);
            downloadRelayHeaders = Map.copyOf(headers);
            return directUrl;
        }

        String verificationFile = PatternUtil.matchData("'file':'(.*?)'", verificationPage.body());
        String verificationSign = PatternUtil.matchData("'sign':'(.*?)'", verificationPage.body());
        if (ObjectUtils.isEmpty(verificationFile) || ObjectUtils.isEmpty(verificationSign)) {
            logger.warn("[LanZouApiProduct]({}) download verification parameters missing, status={}, body={}",
                    id, verificationPage.statusCode(), responseSummary(verificationPage));
            return null;
        }

        URI verificationUri = URI.create(verificationUrl);
        String origin = verificationUri.getScheme() + "://" + verificationUri.getAuthority();
        headers.put("Origin", origin);
        headers.put("X-Requested-With", "XMLHttpRequest");
        HashMap<String, String> params = new HashMap<>();
        params.put("file", verificationFile);
        params.put("el", "2");
        params.put("sign", verificationSign);

        try {
            Thread.sleep(2100L);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return null;
        }

        HttpClientUtil.HttpResult verificationResult = postWithoutRedirects(origin + "/file/ajax.php", params, headers);
        String redirectUrl = verificationResult.firstHeader("Location");
        if (!ObjectUtils.isEmpty(redirectUrl)) {
            String resolvedUrl = verificationUri.resolve(redirectUrl).toString();
            fileInfo.setDownloadUrl(resolvedUrl);
            downloadRelayHeaders = relayHeaders(headers);
            return resolvedUrl;
        }
        LanZouFileInfoRespModel resolved = GsonUtil.toBean(verificationResult.body(), LanZouFileInfoRespModel.class);
        if (resolved == null || resolved.getZt() != 1 || ObjectUtils.isEmpty(resolved.getDownloadPath())
                || resolved.getDownloadPath().startsWith("?")) {
            logger.warn("[LanZouApiProduct]({}) download verification failed, status={}, body={}",
                    id, verificationResult.statusCode(), responseSummary(verificationResult));
            return null;
        }

        String resolvedUrl = resolveDownloadAddress(origin, resolved.getDownloadHost(), resolved.getDownloadPath());
        fileInfo.setDownloadUrl(resolvedUrl);
        downloadRelayHeaders = relayHeaders(headers);
        return resolvedUrl;
    }

    private static boolean isBinaryFileResponse(String contentType, String body) {
        if (contentType == null || contentType.isBlank()) return false;
        String normalized = contentType.toLowerCase(Locale.ROOT);
        if (normalized.contains("text/") || normalized.contains("html")
                || normalized.contains("json") || normalized.contains("xml")
                || normalized.contains("javascript") || normalized.contains("urlencoded")) {
            return false;
        }
        String trimmed = body == null ? "" : body.trim().toLowerCase(Locale.ROOT);
        return !(trimmed.startsWith("{") || trimmed.startsWith("[")
                || trimmed.contains("error") || trimmed.contains("not found")
                || trimmed.contains("过期") || trimmed.contains("不存在"));
    }

    static boolean hasVerificationMetadata(FileInfoModel fileInfo) {
        return fileInfo != null && !ObjectUtils.isEmpty(fileInfo.getDownloadHost())
                && !ObjectUtils.isEmpty(fileInfo.getDownloadPath());
    }

    static String buildVerificationUrl(String downloadHost, String downloadPath) {
        if (ObjectUtils.isEmpty(downloadHost) || ObjectUtils.isEmpty(downloadPath)) return null;
        String host = decodeHtmlUrl(downloadHost.trim());
        String path = decodeHtmlUrl(downloadPath.trim());
        URI hostUri = URI.create(host);

        // Folder item pages already expose a host ending in /file/ and a query-only
        // token. Adding another /file/ produces /file/file/?token and a 404/403.
        if (path.startsWith("?")) {
            String hostPath = Objects.toString(hostUri.getPath(), "");
            String base;
            if (hostPath.endsWith("/file") || hostPath.endsWith("/file/")) {
                base = host.endsWith("/") ? host : host + "/";
            } else {
                base = host.replaceAll("/+$", "") + "/file/";
            }
            return URI.create(base + path).toString();
        }
        String hostPath = Objects.toString(hostUri.getPath(), "");
        if (hostPath.endsWith("/file") || hostPath.endsWith("/file/")) {
            return resolveDownloadAddress(host, host, path);
        }
        String base = host.replaceAll("/+$", "") + "/file/";
        return URI.create(base).resolve(path.replaceFirst("^/", "")).toString();
    }

    static String resolveDownloadAddress(String baseUrl, String downloadHost, String downloadPath) {
        if (ObjectUtils.isEmpty(downloadPath)) return null;
        String path = decodeHtmlUrl(downloadPath.trim());
        if (path.startsWith("http://") || path.startsWith("https://")) return path;

        boolean hasDownloadHost = !ObjectUtils.isEmpty(downloadHost);
        String base = hasDownloadHost ? decodeHtmlUrl(downloadHost.trim()) : baseUrl;
        if (ObjectUtils.isEmpty(base)) return null;
        URI baseUri = URI.create(base);
        if (hasDownloadHost && !base.endsWith("/")) {
            baseUri = URI.create(base + "/");
        }
        return baseUri.resolve(hasDownloadHost ? path.replaceFirst("^/", "") : path).toString();
    }

    private static String decodeHtmlUrl(String value) {
        return value.replace("&amp;", "&").replace("&#38;", "&");
    }

    public Map<String, String> getDownloadRelayHeaders() {
        return downloadRelayHeaders;
    }

    private Map<String, String> getDownloadVerificationHeaders(String verificationUrl) {
        HashMap<String, String> headers = new HashMap<>();
        headers.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        headers.put("Accept-Encoding", "gzip, deflate");
        headers.put("Accept-Language", "zh-CN,zh;q=0.9");
        headers.put("Referer", verificationUrl);
        headers.put("User-Agent", DOWNLOAD_USER_AGENT);
        return headers;
    }

    private String cookieHeader(List<String> cookies) {
        if (cookies == null || cookies.isEmpty()) {
            return "";
        }
        return cookies.stream()
                .map(cookie -> cookie.split(";", 2)[0])
                .filter(cookie -> !cookie.isBlank())
                .reduce((left, right) -> left + "; " + right)
                .orElse("");
    }

    private Map<String, String> relayHeaders(Map<String, String> headers) {
        HashMap<String, String> relayHeaders = new HashMap<>(headers);
        relayHeaders.remove("Origin");
        relayHeaders.remove("X-Requested-With");
        return Map.copyOf(relayHeaders);
    }

    private String responseSummary(HttpClientUtil.HttpResult response) {
        String body = response == null ? "" : response.body();
        int limit = 1000;
        return body.length() <= limit ? body : body.substring(0, limit) + "... (" + body.length() + " chars)";
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

    private HttpClientUtil.HttpResult get(String url, Map<String, String> headers) {
        try {
            return HttpClientUtil.getResponse(url, headers, null);
        } catch (Exception exception) {
            throw new IllegalStateException("LanZou GET request failed: " + url, exception);
        }
    }

    private HttpClientUtil.HttpResult getWithoutRedirects(String url, Map<String, String> headers) {
        try {
            return HttpClientUtil.getResponseWithoutRedirects(url, headers, null);
        } catch (Exception exception) {
            throw new IllegalStateException("LanZou GET request failed: " + url, exception);
        }
    }

    private HttpClientUtil.HttpResult post(String url, Map<String, ?> params, Map<String, String> headers) {
        try {
            return HttpClientUtil.postFormResponse(url, headers, params);
        } catch (Exception exception) {
            throw new IllegalStateException("LanZou POST request failed: " + url, exception);
        }
    }


    private HttpClientUtil.HttpResult postWithoutRedirects(String url, Map<String, ?> params,
                                                           Map<String, String> headers) {
        try {
            return HttpClientUtil.postFormResponseWithoutRedirects(url, headers, params);
        } catch (Exception exception) {
            throw new IllegalStateException("LanZou POST request failed: " + url, exception);
        }
    }
}
