package com.koala.factory.extra.kugou;

import com.koala.service.utils.MD5Utils;

import java.util.Arrays;
import java.util.Map;

import static com.koala.factory.secretKey.KugouSecretKeyCollector.KUGOU_PID_VERSION_SECRET_KEY;

public class KugouSingnatureGenerator {

    public static String generateKugouKey(String hash, String appId, String mid, String userId) {
        return MD5Utils.md5(nullToEmpty(hash) + KUGOU_PID_VERSION_SECRET_KEY + nullToEmpty(appId) + nullToEmpty(mid) + nullToEmpty(userId));
    }

    public static String generateKugouSignatureV2(String secret, Map<String, String> params) {
        if (params == null) {
            return null;
        }
        StringBuilder result = new StringBuilder(secret);
        for (Map.Entry<String, String> entry : params.entrySet()) {
            result.append(entry.getKey()).append("=").append(nullToEmpty(entry.getValue()));
        }
        return MD5Utils.md5(result + secret);
    }

    public static String generateKugouSignatureV1(String secret, Map<String, String> map) {
        if (map == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        String[] keys = map.keySet().toArray(new String[0]);
        Arrays.sort(keys);
        for (String key : keys) {
            sb.append(key);
            sb.append("=");
            sb.append(map.get(key));
        }
        return MD5Utils.md5(secret + sb + secret);
    }

    public static String getGetRequestParams(Map<String, String> map) {
        if (map == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder("?");
        for (String key : map.keySet()) {
            sb.append(key);
            sb.append("=");
            sb.append(map.get(key));
            sb.append("&");
        }
        sb.deleteCharAt(sb.length() - 1);
        return sb.toString();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
