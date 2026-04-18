package com.koala.factory.extra.kugou;

import com.koala.service.utils.MD5Utils;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * @author koala
 * @version 1.0
 * @date 2023/6/20 13:07
 * @description
 */
public class KugouPlayInfoParamsGenerator {

    private static final String CURRENT_UUID = UUID.randomUUID().toString().replace("-", "");

    public static String getPlayInfoTextParams(long timestamp, String hash, String mid, String albumId, KugouCustomParamsUtil customParams) {
        String userId = customParams.getKugouCustomParams().get("userId").toString();
        String[] paramsArray = {
                "NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt",
                "clienttime=" + timestamp,
                "clientver=2000",
                "dfid=2lOrgp0YdjFP47krxK4B8tye",
                "cmd=26",
                "pid=4",
                "authType=1",
                "hash=" + hash.toLowerCase(),
                "key=" + getKey(hash, mid, userId),
                "behavior=play",
                "module=",
                "appid=1155",
                "mid=" + mid,
                "userid=" + userId,
                "token=" + customParams.getKugouCustomParams().get("token").toString(),
                "version=3.1.2",
                "vipType=6",
                "album_id=" + albumId,
                "NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt"
        };
        return String.join("", paramsArray);
    }

    public static Map<String, String> getPlayInfoParams(long timestamp, String hash, String mid, String albumId, KugouCustomParamsUtil customParams, String signature) {
        String userId = customParams.getKugouCustomParams().get("userId").toString();
        LinkedHashMap<String, String> params = new LinkedHashMap<>();
        params.put("clienttime", String.valueOf(timestamp));
        params.put("clientver", String.valueOf(2000));
        params.put("dfid", "2lOrgp0YdjFP47krxK4B8tye");
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
        params.put("signature", signature);
        return params;
    }

    public static Map<String, String> getPlayInfoParams(String hash, String mid, String albumId, KugouCustomParamsUtil customParams) {
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
}
