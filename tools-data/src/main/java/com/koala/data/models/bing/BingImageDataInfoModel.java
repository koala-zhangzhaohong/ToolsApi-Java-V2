package com.koala.data.models.bing;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

@Data
public class BingImageDataInfoModel implements Serializable {
    private String url;
    @SerializedName("cdn_url")
    private String cdnUrl;
}
