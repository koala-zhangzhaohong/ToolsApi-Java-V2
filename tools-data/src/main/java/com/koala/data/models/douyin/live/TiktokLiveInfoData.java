package com.koala.data.models.douyin.live;

import com.google.gson.annotations.SerializedName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class TiktokLiveInfoData implements Serializable {
    @SerializedName("user_id")
    private String userId;
    @SerializedName("room_id")
    private String roomId;
    @SerializedName("user_unique_id")
    private String userUniqueId;
    @SerializedName("room_info")
    private TiktokLiveRoomInfoData roomInfo;
    @SerializedName("anchor_id")
    private String anchorId;
    private String nickname;
    @SerializedName("sec_uid")
    private String secUid;
    private String ttwid;
}
