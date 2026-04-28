package com.koala.data.models.douyin.live;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.io.Serializable;

@Data
public class TiktokMediaData implements Serializable {
    @SerializedName("preview_path_hls")
    private String previewPathHLS;
    @SerializedName("preview_path_flv")
    private String previewPathFLV;
    @SerializedName("preview_path")
    private String previewPath;
    @SerializedName("proxy_preview_path")
    private Object proxyPreviewPath;
    @SerializedName("download_path")
    private String downloadPath;
    @SerializedName("proxy_download_path")
    private Object proxyDownloadPath;
}
