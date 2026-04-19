package com.koala.factory.extra.kugou;

import com.koala.service.utils.MD5Utils;

import java.util.*;

import static com.koala.factory.SecretKey.KugouSecretKeyCollector.KUGOU_PID_VERSION_SECRET_KEY;
import static com.koala.factory.extra.kugou.KugouSingnatureGenerator.*;

/**
 * @author koala
 * @version 1.0
 * @date 2023/6/20 13:07
 * @description
 */
public class KugouPlayInfoParamsGenerator {

    private static final String CURRENT_UUID = UUID.randomUUID().toString().replace("-", "");

    public static Map<String, String> getPlayInfoParamsV3(long timestamp, String hash, String mid, String albumId, KugouCustomParamsUtil customParams) {
        String userId = customParams.getKugouCustomParams().get("userId").toString();
        String appId = "1005";
        LinkedHashMap<String, String> params = new LinkedHashMap<>();
        params.put("dfid", "2lOrgp0YdjFP47krxK4B8tye");
        params.put("hash", hash.toLowerCase());
        params.put("mtype", "2");
        params.put("album_id", albumId);
        params.put("album_audio_id", albumId);
        params.put("module", "");
        params.put("behavior", "play");
        params.put("cmd", "26");
        params.put("uuid", CURRENT_UUID);
        params.put("clientver", "10479");
        params.put("clienttime", timestamp / 1000 + "");
        params.put("pid", "2");
        params.put("appid", appId);
        params.put("mid", mid);
        params.put("version", "10479");
        params.put("token", customParams.getKugouCustomParams().get("token").toString());
        params.put("vipType", "6");
        params.put("userid", userId);
        params.put("area_code", "1");
        params.put("ptype", "0");
        params.put("pidversion", KUGOU_PID_VERSION_SECRET_KEY);
        params.put("quality", "flac");
        params.put("key", generateKugouKey(hash, appId, mid, userId));
        String signature = generateKugouSignatureV1(params);
        if (signature == null || signature.isBlank()) {
            return null;
        }
        params.put("signature", signature);
        System.out.println(getGetRequestParams(params));
        return params;
    }

    public static Map<String, String> getPlayInfoParamsV1(String hash, String mid, String albumId, KugouCustomParamsUtil customParams) {
        String userId = customParams.getKugouCustomParams().get("userId").toString();
        LinkedHashMap<String, String> params = new LinkedHashMap<>();
        params.put("cmd", "26");
        params.put("pid", "4");
        params.put("authType", "1");
        params.put("hash", hash);
        params.put("key", getKey(hash, mid, userId));
        params.put("behavior", "play");
        params.put("module", "");
        params.put("appid", "1155");
        params.put("mid", mid);
        params.put("userid", userId);
        params.put("token", customParams.getKugouCustomParams().get("token").toString());
        params.put("version", "3.1.2");
        params.put("vipType", "6");
        params.put("album_id", albumId);
        return params;
    }

    private static String getKey(String hash, String mid, String userId) {
        return MD5Utils.md5(hash.toLowerCase() + "kgcloudv21155" + mid + userId);
    }

    private static String getGetRequestParams(Map<String,String> map) {
        if (map == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("?");
        Set<String> keySet = map.keySet();
        for (String str : keySet) {
            sb.append(str);
            sb.append("=");
            sb.append(map.get(str));
            sb.append("&");
        }
        sb.deleteCharAt(sb.length() - 1);
        return sb.toString();
    }

}
