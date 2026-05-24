package com.koala.data.models.bing;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
public class BingRespDataModel implements Serializable {
    private List<BingImageDataModel> images;
}