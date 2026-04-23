package com.koala.factory.builder;

import java.io.IOException;
import java.net.URISyntaxException;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:28
 * @description
 */
public class ConcreteLanZouApiV2Builder extends LanZouApiV2Builder {
    @Override
    public LanZouApiV2Builder url(String url) {
        product.setUrl(url);
        return this;
    }

    @Override
    public LanZouApiV2Builder password(String password) {
        product.setPassword(password);
        return this;
    }

    @Override
    public LanZouApiV2Builder init() throws IOException, URISyntaxException {
        product.init();
        return this;
    }

    @Override
    public LanZouApiV2Builder getIdByUrl() {
        product.getIdByUrl();
        return this;
    }

}
