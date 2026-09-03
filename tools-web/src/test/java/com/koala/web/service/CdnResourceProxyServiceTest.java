package com.koala.web.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CdnResourceProxyServiceTest {

    private final CdnResourceProxyService service = new CdnResourceProxyService();

    @Test
    void addsPublicProxyPrefixToLegacyMiddlewareUrl() {
        assertEquals(
                "https://cdn.example.com/proxy/doProxy?host=x&path=y",
                service.normalizePublicCdnUrl("https://cdn.example.com/doProxy?host=x&path=y"));
    }

    @Test
    void keepsCurrentPublicProxyUrlUnchanged() {
        assertEquals(
                "https://cdn.example.com/proxy/doProxy?host=x&path=y",
                service.normalizePublicCdnUrl("https://cdn.example.com/proxy/doProxy?host=x&path=y"));
    }
}
