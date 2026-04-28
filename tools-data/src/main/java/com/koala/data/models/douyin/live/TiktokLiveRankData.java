package com.koala.data.models.douyin.live;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;
import java.util.ArrayList;

@Data
public class TiktokLiveRankData implements Serializable {
    @SerializedName("rank_list_url")
    private String rankListUrl;
    @SerializedName("rank_list_url_backup")
    private String rankListUrlBackup;
    @SerializedName("rank_list_special")
    private ArrayList<String> rankListSpecial;
}
