package com.koala.service.signature;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class DouyinSignatureServiceTest {
    private final DouyinSignatureService service = DouyinSignatureService.getInstance();

    @Test
    void generatesAllInProcessDouyinSignatures() {
        String query = "aid=6383&app_name=douyin_web&room_id=123456&msToken=test-token";

        assertFalse(service.generateXBogus(query, DouyinSignatureService.USER_AGENT).isBlank());
        assertFalse(service.generateABogus(query, "").isBlank());
        assertFalse(service.generateLiveSignature("123456", "78910").isBlank());
        assertEquals(107, service.generateMsToken().length());
    }
}
