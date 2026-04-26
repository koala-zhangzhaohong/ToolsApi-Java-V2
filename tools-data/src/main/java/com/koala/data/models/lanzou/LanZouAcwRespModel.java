package com.koala.data.models.lanzou;

import lombok.Data;

import java.io.Serializable;

@Data
public class LanZouAcwRespModel implements Serializable {
    private Integer code;
    private String msg;
    private LanZouAcwInfoModel data;
}
