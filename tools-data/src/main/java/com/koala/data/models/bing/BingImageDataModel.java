package com.koala.data.models.bing;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
@SuppressWarnings("ALL")
public class BingImageDataModel implements Serializable {
    private String startdate;
    private String fullstartdate;
    private String enddate;
    private String url;
    private String urlbase;
    private String copyright;
    private String copyrightlink;
    private String title;
    private String quiz;
    private boolean wp;
    private String hsh;
    private int drk;
    private int top;
    private int bot;
    private List<String> hs;
}
