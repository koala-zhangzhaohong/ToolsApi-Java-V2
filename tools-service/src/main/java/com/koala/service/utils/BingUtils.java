package com.koala.service.utils;

import com.koala.data.models.bing.BingRespDataModel;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Objects;
import java.util.Random;

@SuppressWarnings("ALL")
public class BingUtils {

    public static String getImage(Boolean flag) throws IOException, URISyntaxException {
        try {
            return doRequest(Objects.requireNonNullElse(flag, false), "2");
        } catch (Exception e) {
            return doRequest(true, "1");
        }
    }

    private static String doRequest(Boolean flag, String number) throws IOException, URISyntaxException {
        String url = "https://cn.bing.com/HPImageArchive.aspx";
        HashMap<String, String> params = new HashMap<>();//请求参数
        params.put("format", "js");
        int day = flag == true ? 0 : new Random().nextInt(10);//获取必应最近7天壁纸，必应限制只显示最近7天，随机获取，大于7，显示7的壁纸
        params.put("idx", String.valueOf(day));
        params.put("n", number);
        String response = HttpClientUtil.doGet(url, HeaderUtil.getHeader(), params);
        BingRespDataModel data = GsonUtil.toBean(response, BingRespDataModel.class);
        if (!data.getImages().isEmpty()) {
            String imgUrl = data.getImages().get(0).getUrl();
            return "https://cn.bing.com" + imgUrl;
        } else {
            return null;
        }
    }

}
