package com.koala.data.models.douyin.v1.roomInfoData;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

/**
 * @author koala
 * @version 1.0
 * @date 2023/4/22 21:51
 * @description
 */
@Data
public class Owner implements Serializable {
    @SerializedName("id_str")
    private String idStr;
    @SerializedName("sec_uid")
    private String secUid;
    @SerializedName("short_id")
    private String shortId;
    @SerializedName("unique_id")
    private String uniqueId;
    @SerializedName("web_rid")
    private String webRid;
    private String nickname;
    @SerializedName("avatar_thumb")
    private AvatarThumbModel avatarThumb;
    @SerializedName("follow_info")
    private FollowInfoModel followInfo;
}
