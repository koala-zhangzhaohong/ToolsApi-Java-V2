package com.koala.data.models.douyin.profile;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

@Data
public class TiktokUserInfoDataModel implements Serializable {
    private String nickname;
    @SerializedName("short_id")
    private String shortId;
    private String uid;
    @SerializedName("unique_id")
    private String uniqueId;
}
