package com.koala.base.enums;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/19 15:38
 * @description
 */

import lombok.Getter;

import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;

@Getter
public enum TemplateEnum {
    TEMPLATE_403_WEB(1, "TEMPLATE_403", "403/index", null),
    TEMPLATE_404_WEB(2, "TEMPLATE_404", "404/index", null),
    TEMPLATE_500_WEB(3, "TEMPLATE_500", "500/index", null),
    TEMPLATE_JSON_WEB(4, "TEMPLATE_JSON", "json/index", null),
    TEMPLATE_JSON_PRO_WEB(5, "TEMPLATE_JSON_PRO", "json/pro/index", null),
    TEMPLATE_TIKTOK_API(6, "TEMPLATE_TIKTOK_API", "json/pro/tiktok/api/index", null),
    TEMPLATE_TIKTOK_RANKLIST(7, "TEMPLATE_TIKTOK_RANKLIST", "json/pro/tiktok/ranklist/index", "tools/DouYin/api/ranklist/audience");

    private final Integer id;
    private final String name;
    private final String path;
    private final String prefix;

    TemplateEnum(Integer id, String name, String path, String prefix) {
        this.id = id;
        this.name = name;
        this.path = path;
        this.prefix = prefix;
    }

    public static TemplateEnum getTemplateById(Integer id) {
        Optional<TemplateEnum> optional = Arrays.stream(TemplateEnum.values()).filter(item -> item.getId().equals(id)).findFirst();
        return optional.orElse(TEMPLATE_404_WEB);
    }

    public static Integer getTemplateByPath(String host, String path) {
        if (Objects.isNull(path)) {
            return -1;
        }
        Optional<TemplateEnum> optional = Arrays.stream(TemplateEnum.values()).filter(item -> {
            if (!Objects.isNull(item.getPrefix())) {
                return path.replaceFirst(host, "").startsWith(item.getPrefix());
            }
            return false;
        }).findFirst();
        return optional.map(TemplateEnum::getId).orElse(-1);
    }

}
