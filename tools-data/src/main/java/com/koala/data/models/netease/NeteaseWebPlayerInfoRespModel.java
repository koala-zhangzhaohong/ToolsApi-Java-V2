package com.koala.data.models.netease;

import com.google.gson.annotations.SerializedName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class NeteaseWebPlayerInfoRespModel implements Serializable {
    private String id;
    private String quality;
    private String url;
    @SerializedName("lyric_info")
    private String lyricInfo;
    @SerializedName("player_url")
    private String playerUrl;
}
