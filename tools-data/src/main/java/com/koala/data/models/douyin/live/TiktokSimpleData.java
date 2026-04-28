package com.koala.data.models.douyin.live;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

@Data
public class TiktokSimpleData implements Serializable {
    @SerializedName("id_str")
    private String idStr;
    @SerializedName("user_id")
    private String userId;
    @SerializedName("sec_uid")
    private String secUserId;
    @SerializedName("room_id")
    private String roomId;
    private String title;
    private String desc;
    private Object cover;
    private String nickname;
    private String signature;
    @SerializedName("short_id")
    private String shortId;
    private String uid;
    @SerializedName("unique_id")
    private String uniqueId;
    @SerializedName("rank_data")
    private TiktokLiveRankData rankData;
    @SerializedName("media_data")
    private TiktokMediaData mediaData;
}