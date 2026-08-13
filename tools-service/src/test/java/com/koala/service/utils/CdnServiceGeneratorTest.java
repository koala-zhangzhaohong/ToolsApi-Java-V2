package com.koala.service.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CdnServiceGeneratorTest {

    @Test
    void extractsOriginWithoutTreatingUrlAsRegex() {
        assertEquals(
                "https://audio.example.com:8443",
                CdnServiceGenerator.getRegHost("https://audio.example.com:8443/path/file.mp3?token=a.b+c"));
    }

    @Test
    void generatesDirectVideoMiddlewareUrl() {
        String url = CdnServiceGenerator.getCdnService(
                "https://audio.example.com/path/file.mp3?token=a.b+c",
                "https://app.example.com/",
                "http://cdn.example.com/",
                true,
                null,
                "sample",
                "mp3",
                true,
                null,
                true,
                false,
                null);

        assertTrue(url.startsWith("https://cdn.example.com/proxy/doProxy?"));
        assertTrue(url.contains("host=https%3A%2F%2Faudio.example.com"));
        assertTrue(url.contains("path=%2Fpath%2Ffile.mp3%3Ftoken%3Da.b%2Bc"));
        assertTrue(url.contains("isDownload=true"));
    }

    @Test
    void generatesHttpMiddlewareUrlWithoutDuplicateSlashOrLegacyPrefix() {
        String url = CdnServiceGenerator.getCdnService(
                "http://media.example.com/video.mp4",
                "http://app.example.com/",
                "http://cdn.example.com///",
                true, null, null, null, false, null, false, false, null);

        assertTrue(url.startsWith("http://cdn.example.com/proxy/doProxy?"));
    }

    @Test
    void preservesCdnHostWhenItHasNoTrailingSlash() {
        String url = CdnServiceGenerator.getCdnService(
                "https://media.example.com/video.mp4",
                "https://app.example.com/",
                "https://cdn.example.com",
                true, " ", " ", " ", false, null, true, false, null);

        assertTrue(url.startsWith("https://cdn.example.com/proxy/doProxy?"));
        assertTrue(!url.contains("referer=") && !url.contains("fileName=") && !url.contains("extension="));
    }

    @Test
    void rejectsBlankCdnHostAndIncompleteShortUrlConfiguration() {
        assertNull(CdnServiceGenerator.getCdnService(
                "https://media.example.com/video.mp4", "https://app.example.com/", " ",
                true, null, null, null, false, null, true, false, null));
        assertNull(CdnServiceGenerator.getCdnService(
                "https://media.example.com/video.mp4", "https://app.example.com/", "https://cdn.example.com",
                true, null, null, null, false, null, true, true, null));
    }
}
