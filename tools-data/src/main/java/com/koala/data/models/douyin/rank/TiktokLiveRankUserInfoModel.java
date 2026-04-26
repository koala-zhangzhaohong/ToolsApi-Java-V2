package com.koala.data.models.douyin.rank;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

@Data
public class TiktokLiveRankUserInfoModel implements Serializable {
    private Long id;
    @SerializedName("short_id")
    private Long shortId;
    private String nickname;
    @SerializedName("avatar_thumb")
    private Object avatorThumb;
    @SerializedName("pay_grade")
    private Object payGrade;
    @SerializedName("display_id")
    private String displayId;
    @SerializedName("sec_uid")
    private String secUid;
    @SerializedName("webcast_uid")
    private String webcastUid;
    @SerializedName("is_hidden")
    private Boolean isHidden;
    @SerializedName("user_info_direction")
    private String userInfoDirection;
    @SerializedName("user_real_nickname")
    private String userRealNickName;
}
