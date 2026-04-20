package com.koala.base.enums;

import lombok.Getter;

import java.util.Arrays;
import java.util.Optional;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/11 17:00
 * @description
 */
@Getter
public enum DouyinMiddlewareServerEnums {
    PREFIX_1("https://v26-web.douyinvod.com/", 55080),
    PREFIX_2("https://v11-weba.douyinvod.com/", 55081),
    PREFIX_3("https://v5-dy-o-detect.zjcdn.com/", 55082),
    PREFIX_4("https://www.douyin.com/", 55083);

    private final String prefix;
    private final Integer port;

    DouyinMiddlewareServerEnums(String prefix, Integer port) {
        this.prefix = prefix;
        this.port = port;
    }

    public static DouyinMiddlewareServerEnums getDouyinMiddlewareServerEnumsByUrl(String url) {
        Optional<DouyinMiddlewareServerEnums> optional = Arrays.stream(DouyinMiddlewareServerEnums.values()).filter(item -> url.startsWith(item.prefix)).findFirst();
        return optional.orElse(null);
    }
}
