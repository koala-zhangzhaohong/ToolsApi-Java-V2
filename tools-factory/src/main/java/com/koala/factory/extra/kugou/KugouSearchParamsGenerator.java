package com.koala.factory.extra.kugou;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static com.koala.factory.SecretKey.KugouSecretKeyCollector.KUGOU_SEARCH_SECRET_KEY;
import static com.koala.factory.extra.kugou.KugouSingnatureGenerator.generateKugouSignatureV1;

/**
 * @author koala
 * @version 1.0
 * @date 2023/6/19 20:38
 * @description
 */
public class KugouSearchParamsGenerator {

    private static final String CURRENT_UUID = UUID.randomUUID().toString().replace("-", "");

    public static Map<String, String> getSearchParams(Long timestamp, String key, String mid, Long page, Long limit, KugouCustomParamsUtil customParams) {
        Map<String, String> params = new HashMap<>();
        params.put("bitrate", "0");
        params.put("clienttime", String.valueOf(timestamp));
        params.put("clientver", "2000");
        params.put("dfid", "-");
        params.put("filter", "10");
        params.put("inputtype", "0");
        params.put("iscorrection", "1");
        params.put("isfuzzy", "0");
        params.put("keyword", key);
        params.put("mid", mid);
        params.put("page", String.valueOf(page));
        params.put("pagesize", String.valueOf(limit));
        params.put("platform", "WebFilter");
        params.put("privilege_filter", "0");
        params.put("srcappid", "2919");
        params.put("token", customParams.getKugouCustomParams().get("token").toString());
        params.put("userid", customParams.getKugouCustomParams().get("userId").toString());
        params.put("uuid", CURRENT_UUID);
        params.put("signature", generateKugouSignatureV1(KUGOU_SEARCH_SECRET_KEY, params));
        return params;
    }
}
