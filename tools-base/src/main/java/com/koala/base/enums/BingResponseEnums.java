package com.koala.base.enums;

/**
 * @author koala
 * @version 1.0
 * @date 2022/2/19 15:38
 * @description
 */

import lombok.Getter;

@Getter
public enum BingResponseEnums {
    FAILURE(-1, "UNKNOWN_ERROR"),
    GET_DATA_SUCCESS(200, "GET_DATA_SUCCESS"),
    GET_INFO_ERROR(201, "GET_INFO_ERROR");

    private final Integer code;
    private final String message;

    BingResponseEnums(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
