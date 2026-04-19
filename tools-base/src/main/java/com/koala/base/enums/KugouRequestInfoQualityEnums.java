package com.koala.base.enums;

import lombok.Getter;

import java.util.Arrays;
import java.util.Optional;

/**
 * @author koala
 * @version 1.0
 * @date 2023/6/21 10:45
 * @description
 */
@Getter
public enum KugouRequestInfoQualityEnums {
    QUALITY_DEFAULT("default", 0),
    QUALITY_128("128", 1),
    QUALITY_320("320", 2),
    QUALITY_FLAC("flac", 3),
    QUALITY_HIGH("high", 4),
    QUALITY_VIPER_ATMOS("viper_atmos", 5),
    QUALITY_VIPER_TAPE("viper_tape", 6),
    QUALITY_VIPER_CLEAR("viper_clear", 7);

    private final String type;
    private final Integer id;

    KugouRequestInfoQualityEnums(String type, Integer id) {
        this.type = type;
        this.id = id;
    }

    public static KugouRequestInfoQualityEnums getEnumsByType(Integer id) {
        if (id == 0) {
            return QUALITY_128;
        }
        Optional<KugouRequestInfoQualityEnums> optional = Arrays.stream(KugouRequestInfoQualityEnums.values()).filter(item -> item.getId().equals(id)).findFirst();
        return optional.orElse(QUALITY_128);
    }
}
