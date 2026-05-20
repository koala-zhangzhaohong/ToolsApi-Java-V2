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
    PREFIX_1("https://v26-web.douyinvod.com/", null, 55080, false, true, "proxy", true),
    PREFIX_2("https://v11-weba.douyinvod.com/", null, 55081, false, true, "proxy", true),
    PREFIX_3("https://v5-dy-o-detect.zjcdn.com/", null, 55082, false, true, "proxy", true),
    PREFIX_4("https://www.douyin.com/", null, 55083, false, true, "proxy", true),
    PREFIX_5("https://v5-dy-o-abtest.zjcdn.com/", null, 55084, false, true, "proxy", true),
    PREFIX_6("https://v3-dy-o.zjcdn.com/", null, 55085, false, true, "proxy", true);

    private final String prefix;
    private final Integer port;
    private final Integer origin;
    private final Boolean needOrigin;
    private final Boolean isGateWay;
    private final String serviceName;
    private final Boolean isHttps;

    DouyinMiddlewareServerEnums(String prefix, Integer port, Integer origin, Boolean needOrigin, Boolean isGateWay, String serviceName, Boolean isHttps) {
        this.prefix = prefix;
        this.port = port;
        this.origin = origin;
        this.needOrigin = needOrigin;
        this.isGateWay = isGateWay;
        this.serviceName = serviceName;
        this.isHttps = isHttps;
    }

    public static DouyinMiddlewareServerEnums getDouyinMiddlewareServerEnumsByUrl(String url) {
        Optional<DouyinMiddlewareServerEnums> optional = Arrays.stream(DouyinMiddlewareServerEnums.values()).filter(item -> url.startsWith(item.prefix)).findFirst();
        return optional.orElse(null);
    }
}
