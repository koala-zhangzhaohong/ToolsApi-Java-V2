package com.koala.data.models.douyin.rank;

import lombok.Data;

import java.io.Serializable;
import java.lang.reflect.Array;
import java.util.ArrayList;

@Data
public class TiktokLiveRankDataModel implements Serializable {
    private ArrayList<TiktokLiveRankItemInfoModel> ranks;
}
