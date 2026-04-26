package com.koala.data.models.douyin.rank;

import lombok.Data;

import java.io.Serializable;
import java.util.ArrayList;

@Data
public class TiktokLiveRankSimpleResponseDataModel implements Serializable {
    private String roomId;
    private ArrayList<TiktokLiveRankSimpleUserInfoModel> userList = new ArrayList<>();
}
