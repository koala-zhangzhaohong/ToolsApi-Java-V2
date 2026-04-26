package com.koala.factory.director;

import com.koala.factory.builder.LanZouApiV1Builder;
import com.koala.factory.product.LanZouApiV1Product;

import java.io.IOException;
import java.net.URISyntaxException;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:05
 * @description
 */
public class LanZouApiV1Manager {

    private final LanZouApiV1Builder builder;

    public LanZouApiV1Manager(LanZouApiV1Builder builder) {
        this.builder = builder;
    }

    public LanZouApiV1Product construct(String url, String password) throws IOException, URISyntaxException {
        /*
        * 初始化顺序
        * 1. url
        * 2. password
        * 3. getId
        * 4. getPageData
        * */
        builder.url(url).password(password).getIdByUrl().initPageData();
        builder.printParams();
        builder.printPageData();
        return builder.getProduct();
    }

}
