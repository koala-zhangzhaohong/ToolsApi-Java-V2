package com.koala.factory.builder;

import java.io.IOException;
import java.net.URISyntaxException;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:28
 * @description
 */
public class ConcreteLanZouApiV1Builder extends LanZouApiV1Builder {
    @Override
    public LanZouApiV1Builder url(String url) {
        product.setUrl(url);
        return this;
    }

    @Override
    public LanZouApiV1Builder password(String password) {
        product.setPassword(password);
        return this;
    }

    @Override
    public LanZouApiV1Builder initPageData() throws IOException, URISyntaxException {
        product.initPageData();
        return this;
    }

    @Override
    public LanZouApiV1Builder getIdByUrl() {
        product.getIdByUrl();
        return this;
    }

    @Override
    public void printParams() {
        product.printParams();
    }

    @Override
    public void printPageData() {
        product.printPageData();
    }
}
