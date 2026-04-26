package com.koala.factory.builder;

import com.koala.factory.product.LanZouApiV2Product;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URISyntaxException;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:09
 * @description
 */
public abstract class LanZouApiV2Builder {
    /**
     * 创建产品对象
     */
    protected LanZouApiV2Product product = new LanZouApiV2Product();

    /**
     * @param url 分享文件入参
     * @return Builder
     */
    public abstract LanZouApiV2Builder url(String url);

    /**
     * @param password 密码
     * @return Builder
     */
    public abstract LanZouApiV2Builder password(String password);

    /**
     * @return Builder
     * 仅用来初始化页面数据
     */
    public abstract LanZouApiV2Builder init() throws IOException, URISyntaxException;

    /**
     * @return Builder
     */
    public abstract LanZouApiV2Builder getIdByUrl();

    public LanZouApiV2Product getProduct() {
        return product;
    }
}
