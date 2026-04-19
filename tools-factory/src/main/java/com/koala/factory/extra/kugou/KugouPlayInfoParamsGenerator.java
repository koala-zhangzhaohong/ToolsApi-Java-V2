package com.koala.factory.extra.kugou;

import com.koala.service.utils.MD5Utils;

import java.util.*;

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
        String token = customParams.getKugouCustomParams().get("token").toString();
        String dfid = "2lOrgp0YdjFP47krxK4B8tye";
        String pid = "2";
        String cmd = "26";
        String clienttime = String.valueOf(timestamp / 1000);
        String uuid = CURRENT_UUID;
        String areaCode = "1";//1代表中国地区，如果IP为海外或者港澳台，需要加上这个参数
        String behavior = "play";//需要配置为play，不消耗下载次数。如果配置为download，则会消耗下载次数。
        String appId = "1005";
        String module = "";
        String vipType = "6";
        String ptype = "0";
        String mtype = "2";
        String pidversion = "3001";//用jadx反编译apk后，可以在res目录下找到一个配置文件，里面存储了这个值
        String clientver = "10479";
        String version = "10479";
        String albumAudioId = albumId;

        Map<String, String> params = new HashMap<>();
        params.put("dfid", dfid);
        params.put("hash", hash);
        params.put("mtype", mtype);
        params.put("album_id", albumId);
        params.put("album_audio_id", albumAudioId);
        params.put("module", module);
        params.put("behavior", behavior);
        params.put("cmd", cmd);
        params.put("uuid", uuid);
        params.put("clientver", clientver);
        params.put("clienttime", clienttime);
        params.put("pid", pid);
        params.put("appid", appId);
        params.put("mid", mid);
        params.put("version", version);
        params.put("token", token);
        params.put("quality", "flac");
        params.put("vipType", vipType);
        params.put("userid", userId);
        params.put("area_code", areaCode);
        params.put("dfid", dfid);
        params.put("ptype", ptype);
        params.put("pidversion", pidversion);
        params.put("key", generateKugouKey(hash, appId, mid, userId));
        params.put("signature", generateKugouSignatureV1(params));
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

}
