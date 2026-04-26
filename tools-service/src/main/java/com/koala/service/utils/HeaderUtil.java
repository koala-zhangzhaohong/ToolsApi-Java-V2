package com.koala.service.utils;

import org.springframework.http.HttpHeaders;
import org.springframework.util.StringUtils;

import javax.annotation.Nullable;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static com.koala.service.utils.IpUtil.getRandomIpAddress;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/14 14:44
 * @description
 */
public class HeaderUtil {

    private HeaderUtil() {
    }

    public static Map<String, String> getHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        header.put("Accept-Encoding", "gzip, deflate");
        header.put("Accept-Language", "zh-CN,zh;q=0.8");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getRedirectHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8");
        header.put("Accept-Encoding", "gzip, deflate");
        header.put("Accept-Language", "zh-CN,zh;q=0.9");
        header.put("Cache-Control", "no-cache");
        header.put("Connection", "keep-alive");
        header.put("Pragma", "no-cache");
        header.put("Upgrade-Insecure-Requests", "1");
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static HashMap<String, String> getLanZouInfoHeader(String url, String cookie) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "text/html,application/xhtml+xml,application/xml,application/json,application/x-www-form-urlencoded;q=0.9,image/webp,*/*;q=0.8");
        header.put("Accept-Encoding", "gzip, deflate");
        header.put("Accept-Language", "zh-CN,zh;q=0.8");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        header.put("Referer", url);
        if (!Objects.isNull(cookie)) {
            header.put("Cookie", cookie);
        }
        header.put("Connection", "Keep-Alive");
        return header;
    }

    public static Map<String, String> getVerifyPasswordHeader(String host) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        header.put("Accept-Encoding", "gzip, deflate");
        header.put("Accept-Language", "zh-CN,zh;q=0.8");
        header.put("User-Agent", getUserAgent());
        header.put("Referer", host);
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getDouYinDownloadHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "*/*");
        header.put("Accept-Encoding", "identity;q=1, *;q=0");
        header.put("Accept-Language", "zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7,zh-TW;q=0.6,de;q=0.5,fr;q=0.4,ca;q=0.3,ga;q=0.2");
        header.put("Range", "bytes=0-");
        header.put("Sec-Fetch-Dest", "video");
        header.put("Sec-Fetch-Mode", "no-cors");
        header.put("Sec-Fetch-Site", "cross-sit");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getNeteaseVideoDownloadHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "*/*");
        header.put("Accept-Encoding", "identity;q=1, *;q=0");
        header.put("Accept-Language", "zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7,zh-TW;q=0.6,de;q=0.5,fr;q=0.4,ca;q=0.3,ga;q=0.2");
        header.put("Range", "bytes=0-");
        header.put("Sec-Fetch-Dest", "video");
        header.put("Sec-Fetch-Mode", "no-cors");
        header.put("Sec-Fetch-Site", "cross-sit");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getNeteaseAudioDownloadHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "*/*");
        header.put("Accept-Encoding", "identity;q=1, *;q=0");
        header.put("Accept-Language", "zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7,zh-TW;q=0.6,de;q=0.5,fr;q=0.4,ca;q=0.3,ga;q=0.2");
        header.put("Range", "bytes=0-");
        header.put("Sec-Fetch-Dest", "audio");
        header.put("Sec-Fetch-Mode", "no-cors");
        header.put("Sec-Fetch-Site", "cross-sit");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getKugouMediaDownloadHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "*/*");
        header.put("Accept-Encoding", "identity;q=1, *;q=0");
        header.put("Accept-Language", "zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7,zh-TW;q=0.6,de;q=0.5,fr;q=0.4,ca;q=0.3,ga;q=0.2");
        header.put("Range", "bytes=0-");
        header.put("Sec-Fetch-Dest", "audio");
        header.put("Sec-Fetch-Mode", "no-cors");
        header.put("Sec-Fetch-Site", "cross-sit");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getMockVideoHeader(Boolean isDownload) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept-Ranges", "bytes");
        header.put("Expect", "100-continue");
        header.put("Cache-Control", "max-age=604800, must-revalidate");
        header.put("Content-Type", "video/mp4");
        header.put("Content-Disposition", (Boolean.TRUE.equals(isDownload) ? "attachment" : "inline") + "; " + "filename=" + UUID.randomUUID().toString().replace("-", "") + ".mp4");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getMockDownloadNeteaseFileHeader(String fileName, String fileType) {
        final String currentFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Cache-Control", "no-cache");
        header.put("Pragma", "no-cache");
        header.put("Content-Type", "application/octet-stream");
        header.put("Content-Disposition", "attachment; " + "filename=" + currentFileName + "." + fileType);
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getMockDownloadKugouFileHeader(String fileName, String fileType) {
        final String currentFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Cache-Control", "no-cache");
        header.put("Pragma", "no-cache");
        header.put("Content-Type", "application/octet-stream");
        header.put("Content-Disposition", "attachment; " + "filename=" + currentFileName + "." + fileType);
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getMockLiveStreamHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept-Ranges", "bytes");
        header.put("Expect", "100-continue");
        header.put("Cache-Control", "max-age=604800, must-revalidate");
        header.put("Content-Type", "video/x-flv");
        header.put("Content-Disposition", "inline");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getMockMusicHeader(Boolean isDownload) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept-Ranges", "bytes");
        header.put("Expect", "100-continue");
        header.put("Cache-Control", "max-age=604800, must-revalidate");
        header.put("Content-Type", "audio/mp3");
        header.put("Content-Disposition", (Boolean.TRUE.equals(isDownload) ? "attachment" : "inline") + "; " + "filename=" + UUID.randomUUID().toString().replace("-", "") + ".mp3");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getDouYinSpecialHeader(String token, String ticket, String cookieData, boolean isLive) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", getUserAgent());
        header.put("Accept-Encoding", "None");
        header.put("referer", "https://www.douyin.com/");
        // header.put("Cookie", "ttwid=" + ticket + "; " + cookieData + " msToken=" + token + ";");
        if (isLive) {
            header.put("Cookie", "msToken=" + token + "; ttwid=" + ticket + "; odin_tt=324fb4ea4a89c0c05827e18a1ed9cf9bf8a17f7705fcc793fec935b637867e2a5a9b8168c885554d029919117a18ba69; passport_csrf_token=f61602fc63757ae0e4fd9d6bdcee4810;");
        } else {
            header.put("Cookie", cookieData + "msToken=" + token + "; ttwid=" + ticket + ";");
        }
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getDouYinFeedSpecialHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", "com.ss.android.ugc.aweme.lite/220 (Linux; U; Android 5.1.1; zh_CN; MT2-L05; Build/LMY47V; Cronet/58.0.2991.0)");
        header.put("Accept-Encoding", "None");
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getDouYinWebRequestSpecialHeader(String ticket) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", getUserAgent());
        header.put("Accept-Encoding", "None");
        header.put("referer", "https://www.douyin.com/");
        header.put("Cookie", "ttwid=" + ticket + "; __ac_nonce=0644f93010042b1aedcae; __ac_signature=_02B4Z6wo00f01hyw.YAAAIDD4vyBsOcQreYckPkAAONx9e; __ac_referer=__ac_blank;");
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getDouYinTicketGeneratorHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getNeteaseHeader(String cookie) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/2.10.2.200154");
        header.put("Referer", "");
        header.put("Cookie", cookie);
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getNeteaseDetailHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/2.10.2.200154");
        header.put("Referer", "");
        header.put("Content-Type", "application/x-www-form-urlencoded;charset=utf-8");
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getNeteasePublicWithOutCookieHeader() {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/2.10.2.200154");
        header.put("Referer", "");
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getNeteaseHttpHeader(@Nullable String cookies) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("User-Agent", getUserAgent());
        header.put("Referer", "http://music.163.com");
        header.put("Host", "music.163.com");
        if (StringUtils.hasLength(cookies)) {
            header.put("Cookie", cookies);
        }
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static Map<String, String> getKugouPublicHeader(String userAgent, String cookie) {
        HashMap<String, String> header = new HashMap<>(0);
        if (StringUtils.hasLength(userAgent)) {
            header.put("User-Agent", userAgent);
        } else {
            header.put("User-Agent", RandomUserAgentGenerator.getUserAgent());
        }
        header.put("Referer", "https://www.kugou.com/");
        header.put("x-router", "tracker.kugou.com");
        if (StringUtils.hasLength(cookie)) {
            header.put("Cookie", cookie);
        }
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        return header;
    }

    public static HashMap<String, String> getTiktokRefreshTokenHeader(String cookie) {
        HashMap<String, String> header = new HashMap<>(0);
        header.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        header.put("Accept-Encoding", "gzip, deflate");
        header.put("Accept-Language", "zh-CN,zh;q=0.8");
        header.put("User-Agent", getUserAgent());
        header.put("X-FORWARDED-FOR", getRandomIpAddress());
        header.put("CLIENT-IP", getRandomIpAddress());
        if (StringUtils.hasLength(cookie)) {
            header.put("Cookie", cookie);
        }
        return header;
    }

    public static List<String> setCookies(Map<String, String> cookies) {
        List<String> list = new ArrayList<>();
        if (cookies != null) {
            cookies.forEach((k, v) -> list.add(k + "=" + v));
        }
        return list;
    }

    public static String getUserAgent() {
        String[] userAgentList = new String[]
                {
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36",
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1",
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1",
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
                        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
                        "Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_2 like Mac OS X) AppleWebKit/603.2.4 (KHTML, like Gecko) Mobile/14F89;GameHelper",
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/603.2.4 (KHTML, like Gecko) Version/10.1.1 Safari/603.2.4",
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 10_0 like Mac OS X) AppleWebKit/602.1.38 (KHTML, like Gecko) Version/10.0 Mobile/14A300 Safari/602.1",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:46.0) Gecko/20100101 Firefox/46.0",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:46.0) Gecko/20100101 Firefox/46.0",
                        "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)",
                        "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)",
                        "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
                        "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Win64; x64; Trident/6.0)",
                        "Mozilla/5.0 (Windows NT 6.3; Win64, x64; Trident/7.0; rv:11.0) like Gecko",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/13.10586",
                        "Mozilla/5.0 (iPad; CPU OS 10_0 like Mac OS X) AppleWebKit/602.1.38 (KHTML, like Gecko) Version/10.0 Mobile/14A300 Safari/602.1"
                };

        double index = Math.floor(Math.random() * userAgentList.length);
        return userAgentList[(int) index];
    }

}
