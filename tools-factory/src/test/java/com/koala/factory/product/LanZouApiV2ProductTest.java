package com.koala.factory.product;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class LanZouApiV2ProductTest {

    @Test
    void folderVerificationMetadataTakesPriorityOverPageUrl() {
        var file = new com.koala.data.models.file.FileInfoModel();
        file.setDownloadHost("https://developer2.lanrar.com");
        file.setDownloadPath("temporary-token");
        file.setDownloadUrl("https://developer2.lanrar.com/file/temporary-token");

        assertEquals(true, LanZouApiV2Product.hasVerificationMetadata(file));
    }

    @Test
    void buildsFolderVerificationUrlWithoutDuplicatingFilePath() {
        assertEquals(
                "https://developer2.lanrar.com/file/?temporary-token",
                LanZouApiV2Product.buildVerificationUrl(
                        "https://developer2.lanrar.com/file/", "?temporary-token"));
    }

    @Test
    void addsFilePathForTraditionalVerificationHost() {
        assertEquals(
                "https://developer2.lanrar.com/file/temporary-token",
                LanZouApiV2Product.buildVerificationUrl(
                        "https://developer2.lanrar.com", "temporary-token"));
    }

    @Test
    void combinesPasswordVerificationDownloadHostAndPath() {
        assertEquals(
                "https://developer-oss.lanrar.com/file/token?name=a&download=1",
                LanZouApiV2Product.resolveDownloadAddress(
                        "https://verification.lanzouw.com",
                        "https://developer-oss.lanrar.com",
                        "/file/token?name=a&amp;download=1"));
    }

    @Test
    void keepsAbsoluteDownloadAddressAndDecodesHtmlQuerySeparators() {
        assertEquals(
                "https://cdn.example.com/file.jar?token=a&download=1",
                LanZouApiV2Product.resolveDownloadAddress(
                        "https://verification.lanzouw.com/file/page",
                        null,
                        "https://cdn.example.com/file.jar?token=a&amp;download=1"));
    }

    @Test
    void resolvesRelativeAnchorAgainstVerificationPage() {
        assertEquals(
                "https://verification.lanzouw.com/file/download/token",
                LanZouApiV2Product.resolveDownloadAddress(
                        "https://verification.lanzouw.com/file/page",
                        null,
                        "download/token"));
    }
}
