package com.koala.data.models.douyin.live;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

@Data
public class TiktokLiveRoomInfoData implements Serializable {
    @SerializedName("id_str")
    private String idStr;
    private Integer status;
    @SerializedName("status_str")
    private String statusStr;
    private String title;
}
