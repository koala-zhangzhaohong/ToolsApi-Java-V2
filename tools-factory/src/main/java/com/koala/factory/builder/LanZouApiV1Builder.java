package com.koala.factory.builder;

import com.koala.factory.product.LanZouApiV1Product;

import java.io.IOException;
import java.net.URISyntaxException;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/15 16:09
 * @description
 */
public abstract class LanZouApiV1Builder {
    /**
     * 创建产品对象
     */
    protected LanZouApiV1Product product = new LanZouApiV1Product();

    /**
     * @param url 分享文件入参
     * @return Builder
     */
    public abstract LanZouApiV1Builder url(String url);

    /**
     * @param password 密码
     * @return Builder
     */
    public abstract LanZouApiV1Builder password(String password);

    /**
     * @return Builder
     * 仅用来初始化页面数据
     */
    public abstract LanZouApiV1Builder initPageData() throws IOException, URISyntaxException;

    /**
     * @return Builder
     */
    public abstract LanZouApiV1Builder getIdByUrl();

    /**
     * 打印初始化入参
     */
    public abstract void printParams();

    /**
     * 打印pageData到输出
     */
    public abstract void printPageData();

    public LanZouApiV1Product getProduct() {
        return product;
    }
}
