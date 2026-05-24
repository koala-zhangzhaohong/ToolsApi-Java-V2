package com.koala.service.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@SuppressWarnings("ALL")
public class HttpRequestUtil {

    Logger logger = LoggerFactory.getLogger(HttpRequestUtil.class);

    public static final String DEF_CHATSET = "UTF-8";
    public static final int DEF_CONN_TIMEOUT = 30000;
    public static final int DEF_READ_TIMEOUT = 30000;
    public static String userAgent = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.66 Safari/537.36";

    public enum ContentType {
        json, xml
    }


    /**
     * GET
     *
     * @param strUrl GET请求地址
     * @param params 请求参数
     * @return 网络请求字符串
     * @throws Exception
     */
    public static String httpGet(String strUrl, HashMap<String, String> params) {
        HttpURLConnection conn = null;
        BufferedReader reader = null;
        String response = null;
        try {
            StringBuffer sb = new StringBuffer();
            strUrl = strUrl + "?" + urlencode(params);
            URL url = new URL(strUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-agent", userAgent);
            conn.setUseCaches(false);
            conn.setConnectTimeout(DEF_CONN_TIMEOUT);
            conn.setReadTimeout(DEF_READ_TIMEOUT);
            conn.setInstanceFollowRedirects(false);
            conn.connect();
            InputStream is = conn.getInputStream();
            reader = new BufferedReader(new InputStreamReader(is, DEF_CHATSET));
            String strRead = null;
            while ((strRead = reader.readLine()) != null) {
                sb.append(strRead);
            }
            response = sb.toString();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return response;
    }

    //将map型转为请求参数型
    public static String urlencode(Map<String, String> data) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry i : data.entrySet()) {
            sb.append(i.getKey()).append("=").append(URLEncoder.encode(i.getValue() + "", StandardCharsets.UTF_8)).append("&");
        }
        return sb.toString();
    }
}