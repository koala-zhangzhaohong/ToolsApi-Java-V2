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
    // PREFIX_1采用集群形式
    PREFIX_1("https://v26-web.douyinvod.com/", 55060, 55080),
    PREFIX_2("https://v11-weba.douyinvod.com/", 55061, 55081),
    PREFIX_3("https://v5-dy-o-detect.zjcdn.com/", 55082, null),
    PREFIX_4("https://www.douyin.com/", 55063, 55083),
    PREFIX_5("https://v5-dy-o-abtest.zjcdn.com/", 55084, null),
    PREFIX_6("https://v3-dy-o.zjcdn.com/", 55085, null);

    private final String prefix;
    private final Integer port;
    private final Integer origin;

    DouyinMiddlewareServerEnums(String prefix, Integer port, Integer origin) {
        this.prefix = prefix;
        this.port = port;
        this.origin = origin;
    }

    public static DouyinMiddlewareServerEnums getDouyinMiddlewareServerEnumsByUrl(String url) {
        Optional<DouyinMiddlewareServerEnums> optional = Arrays.stream(DouyinMiddlewareServerEnums.values()).filter(item -> url.startsWith(item.prefix)).findFirst();
        return optional.orElse(null);
    }
}
