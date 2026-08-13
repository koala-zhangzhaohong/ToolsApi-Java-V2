package com.koala.service.utils;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HeaderUtilTest {

    @Test
    void usesDouyinWebOriginForByteDanceCdn() {
        Map<String, String> headers = HeaderUtil.getMediaRelayHeader(
                "https://v3-dy-o-abtest.zjcdn.com/video/tos/cn/tos-cn-ve-15/file.mp4", "video");

        assertEquals("https://www.douyin.com", headers.get("Origin"));
        assertEquals("https://www.douyin.com/", headers.get("Referer"));
        assertEquals("video", headers.get("Sec-Fetch-Dest"));
        assertEquals("cross-site", headers.get("Sec-Fetch-Site"));
    }

    @Test
    void usesTargetOriginForUnknownMediaMiddleware() {
        Map<String, String> headers = HeaderUtil.getMediaRelayHeader(
                "https://media.example.test:8443/doProxy?path=%2Fvideo.mp4", "empty");

        assertEquals("https://media.example.test:8443", headers.get("Origin"));
        assertEquals("https://media.example.test:8443/", headers.get("Referer"));
        assertEquals("empty", headers.get("Sec-Fetch-Dest"));
    }
}
