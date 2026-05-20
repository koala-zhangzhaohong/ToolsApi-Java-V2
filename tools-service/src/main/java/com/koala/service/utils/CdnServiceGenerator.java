package com.koala.service.utils;

import com.koala.service.data.redis.service.RedisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@SuppressWarnings("ALL")
public class CdnServiceGenerator {

    private static final Logger logger = LoggerFactory.getLogger(CdnServiceGenerator.class);

    private final static Long EXPIRE_TIME = 3 * 24 * 60 * 60L;

    public static String getCdnService(String url, String host, Boolean addReferer, String referer, String fileName, String extension, Integer port, Boolean isHttps, RedisService redisService) {
        String inputHost = getRegHost(url);
        String inputPath = url.replaceFirst(inputHost, "");
        StringBuilder cdnPath = new StringBuilder();
        if (isHttps) {
            cdnPath.append(host.replaceFirst("http", "https"));
        } else {
            if (port != null) {
                cdnPath.append(host).append(":").append(port);
            } else {
                cdnPath.append(host);
            }
        }
        cdnPath.append("/");
        if (isHttps) {
            cdnPath.append("proxy/");
        }
        boolean hasParam = false;
        cdnPath.append("doProxy").append("?");
        if (addReferer != null) {
            hasParam = true;
            cdnPath.append("addReferer=").append(addReferer);
        }
        if (referer != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("referer=").append(URLEncoder.encode(referer, StandardCharsets.UTF_8));
        }
        if (fileName != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("fileName=").append(URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        }
        if (extension != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("extension=").append(URLEncoder.encode(extension, StandardCharsets.UTF_8));
        }
        if (inputHost != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("host=").append(URLEncoder.encode(inputHost, StandardCharsets.UTF_8));
        } else {
            logger.info("[cdnService] generate failed: {}, reason: {}", cdnPath, "host is null");
            return null;
        }
        if (inputPath != null) {
            if (hasParam) {
                cdnPath.append("&");
            } else {
                hasParam = true;
            }
            cdnPath.append("path=").append(URLEncoder.encode(inputPath, StandardCharsets.UTF_8));
        } else {
            logger.info("[cdnService] generate failed: {}, reason: {}", cdnPath, "path is null");
            return null;
        }
        logger.info("[cdnService] generate success: {}", cdnPath);
        return null;
    }

    public static String getRegHost(String url) {
        //使用正则表达式过滤，
        String re = "((http|ftp|https)://)(([a-zA-Z0-9._-]+)|([0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}))(([a-zA-Z]{2,6})|(:[0-9]{1,4})?)";
        String str = "";
        // 编译正则表达式
        Pattern pattern = Pattern.compile(re);
        // 忽略大小写的写法
        // Pattern pat = Pattern.compile(regEx, Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(url);
        // 若url==http://127.0.0.1:9040或www.baidu.com的，正则表达式表示匹配
        if (matcher.matches()) {
            str = url;
        } else {
            String[] split2 = url.split(re);
            if (split2.length > 1) {
                str = url.substring(0, url.length() - split2[1].length());
            } else {
                str = split2[0];
            }
        }
        return str;
    }

}
