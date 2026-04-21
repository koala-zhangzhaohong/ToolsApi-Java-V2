package com.koala.data.models.shortUrl;

import com.koala.data.models.douyin.MultiLiveQualityInfoModel;
import com.koala.data.models.douyin.MultiVideoQualityInfoModel;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.io.Serializable;
import java.util.ArrayList;

/**
 * @author koala
 * @version 1.0
 * @date 2023/4/28 11:33
 * @description
 */
@Data
@AllArgsConstructor
public class ShortDouYinItemDataModel implements Serializable {
    private String title;
    private String path;
    private String proxyPath;
    private MultiVideoQualityInfoModel multiVideoQualityInfo;
    private ArrayList<MultiVideoQualityInfoModel> proxyMultiVideoQualityInfoList;
    private MultiLiveQualityInfoModel multiLiveQualityInfo;
}
