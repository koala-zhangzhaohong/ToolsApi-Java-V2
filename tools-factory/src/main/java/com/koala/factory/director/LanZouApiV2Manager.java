package com.koala.factory.director;

import com.koala.factory.builder.LanZouApiV1Builder;
import com.koala.factory.builder.LanZouApiV2Builder;
import com.koala.factory.product.LanZouApiV1Product;
import com.koala.factory.product.LanZouApiV2Product;

import java.io.IOException;
import java.net.URISyntaxException;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:05
 * @description
 */
public class LanZouApiV2Manager {

    private final LanZouApiV2Builder builder;

    public LanZouApiV2Manager(LanZouApiV2Builder builder) {
        this.builder = builder;
    }

    public LanZouApiV2Product construct(String url, String password) throws IOException, URISyntaxException {
        /*
         * 初始化顺序
         * 1. url
         * 2. password
         * 3. getId
         * 4. getPageData
         * */
        builder.url(url).password(password).getIdByUrl().init();
        return builder.getProduct();
    }

}
