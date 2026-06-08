package com.koala.factory.product;

import com.google.common.html.HtmlEscapers;
import com.koala.data.models.douyin.live.TiktokLiveInfoData;
import com.koala.data.models.douyin.live.TiktokLiveRoomInfoData;
import com.koala.service.utils.GsonUtil;
import com.koala.service.utils.HeaderUtil;
import com.koala.service.utils.PatternUtil;
import com.koala.service.utils.RestTemplateUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.HtmlUtils;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Objects;
import java.util.Optional;

@Slf4j
public class DouYinLiveApiProduct {

    private final RestTemplateUtils restTemplateUtils = new RestTemplateUtils();

    private String liveId;

    private final TiktokLiveInfoData liveInfo = new TiktokLiveInfoData();

    public void initRoomInfo() {
        String url = "https://live.douyin.com/%s".formatted(liveId);
        log.info("[DouYinLiveApiProduct] url: {}", url);
        ResponseEntity<String> response = restTemplateUtils.get(url, HeaderUtil.getTiktokLiveGuestHeader(), String.class, new HashMap<>());
        String cookie = Objects.requireNonNull(response.getHeaders().get("Set-Cookie")).getFirst();
        Optional<String> ttwid = Arrays.stream(cookie.split(";")).filter(item -> item.startsWith("ttwid=")).findFirst();
        this.liveInfo.setTtwid(ttwid.map(s -> s.replace("ttwid=", "")).orElse(null));
        log.info("[DouYinLiveApiProduct] current ttwid: {}", this.liveInfo.getTtwid());
        String body = HtmlUtils.htmlUnescape(Objects.requireNonNull(response.getBody()));
        this.liveInfo.setUserId(PatternUtil.matchData("\\\\\"user_id\\\\\":\\\\\"(\\d+)\\\\\"", body));
        this.liveInfo.setRoomId(PatternUtil.matchData("\\\\\"roomId\\\\\":\\\\\"(\\d+)\\\\\"", body));
        this.liveInfo.setUserUniqueId(PatternUtil.matchData("\\\\\"user_unique_id\\\\\":\\\\\"(\\d+)\\\\\"", body));
        TiktokLiveRoomInfoData roomInfoData = new TiktokLiveRoomInfoData();
        roomInfoData.setIdStr(PatternUtil.matchData("\\\\\"roomInfo\\\\\":\\{\\\\\"room\\\\\":\\{\\\\\"id_str\\\\\":\\\\\"(.*?)\\\\\"", body));
        String status = PatternUtil.matchData("\\\\\"roomInfo\\\\\":\\{\\\\\"room\\\\\":\\{\\\\\"id_str\\\\\":\\\\\"%s\\\\\",\\\\\"status\\\\\":(\\d+),".formatted(roomInfoData.getIdStr()), body);
        roomInfoData.setStatus(Objects.isNull(status) ? -1 : Integer.parseInt(status));
        roomInfoData.setStatusStr(PatternUtil.matchData("\\\\\"roomInfo\\\\\":\\{\\\\\"room\\\\\":\\{\\\\\"id_str\\\\\":\\\\\"%s\\\\\",\\\\\"status\\\\\":%s,\\\\\"status_str\\\\\":\\\\\"(.*?)\\\\\",".formatted(roomInfoData.getIdStr(), roomInfoData.getStatus()), body));
        roomInfoData.setTitle(PatternUtil.matchData("\\\\\"roomInfo\\\\\":\\{\\\\\"room\\\\\":\\{\\\\\"id_str\\\\\":\\\\\"%s\\\\\",\\\\\"status\\\\\":%s,\\\\\"status_str\\\\\":\\\\\"%s\\\\\",\\\\\"title\\\\\":\\\\\"(.*?)\\\\\"".formatted(roomInfoData.getIdStr(), roomInfoData.getStatus(), roomInfoData.getStatusStr()), body));
        this.liveInfo.setRoomInfo(roomInfoData);
        this.liveInfo.setAnchorId(PatternUtil.matchData("\\\\\"anchor\\\\\":\\{\\\\\"id_str\\\\\":\\\\\"(\\d+)\\\\\"", body));
        this.liveInfo.setNickname(PatternUtil.matchData("\\\"nickname\\\":\\\"(.*?)\\\"", body));
        this.liveInfo.setSecUid(PatternUtil.matchData("\\\\\"sec_uid\\\\\":\\\\\"(.*?)\\\\\"", body));
        log.info("[DouYinLiveApiProduct] init room info success: {}", GsonUtil.toString(this.liveInfo));
    }

    void main() {
        this.liveId = "22548767101";
        this.liveId = "5200nono";
        initRoomInfo();
    }
}
