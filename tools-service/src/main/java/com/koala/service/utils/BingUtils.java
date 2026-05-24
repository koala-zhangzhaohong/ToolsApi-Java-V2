package com.koala.service.utils;

import com.koala.data.models.bing.BingRespDataModel;
import com.koala.service.data.redis.service.RedisService;
import org.springframework.util.ObjectUtils;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Objects;
import java.util.Random;

import static com.koala.service.data.redis.RedisKeyPrefix.BING_IMG_DATA;
import static com.koala.service.data.redis.RedisKeyPrefix.BING_IMG_LOCKED;

@SuppressWarnings("ALL")
public class BingUtils {

    private final RestTemplateUtils restTemplateUtils = new RestTemplateUtils();

    public String getImage(Boolean flag, RedisService redisService) throws IOException, URISyntaxException {
        if (flag == null) {
            flag = false;
        }
        String key = BING_IMG_DATA + (flag ? "TRUE" : "FALSE") + ":INFO";
        String data = redisService.get(key);
        if (!ObjectUtils.isEmpty(data)) {
            return data;
        }
        String respData = null;
        String locked = redisService.get(BING_IMG_LOCKED);
        if (locked != "true") {
            try {
                respData = doRequest(Objects.requireNonNullElse(flag, false), "2");
            } catch (Exception e) {
                e.printStackTrace();
                respData = doRequest(true, "1");
            }
        }
        // 上锁，防止间歇性不返回，且如果有数据五分钟返回一次
        if (!ObjectUtils.isEmpty(respData) && data != respData) {
            redisService.set(key, respData, 6 * 60 * 60L);
            redisService.set(BING_IMG_LOCKED, "true", 5 * 60L);
        }
        return !ObjectUtils.isEmpty(respData) ? respData : data;
    }

    private String doRequest(Boolean flag, String number) throws IOException, URISyntaxException {
        String url = "https://cn.bing.com/HPImageArchive.aspx";
        HashMap<String, String> params = new HashMap<>();//请求参数
        params.put("format", "js");
        int day = flag == true ? 0 : new Random().nextInt(10);//获取必应最近7天壁纸，必应限制只显示最近7天，随机获取，大于7，显示7的壁纸
        params.put("idx", String.valueOf(day));
        params.put("n", number);
        String response = HttpRequestUtil.httpGet(url, params);
        BingRespDataModel data = GsonUtil.toBean(response, BingRespDataModel.class);
        if (!data.getImages().isEmpty()) {
            String imgUrl = data.getImages().get(0).getUrl();
            return "https://cn.bing.com" + imgUrl;
        } else {
            return null;
        }
    }

}
