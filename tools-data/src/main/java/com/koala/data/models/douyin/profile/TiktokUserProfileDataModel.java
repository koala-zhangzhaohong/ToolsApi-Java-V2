package com.koala.data.models.douyin.profile;

import lombok.Data;

import java.io.Serializable;

@Data
public class TiktokUserProfileDataModel implements Serializable {
    private TiktokUserInfoDataModel user;
}
