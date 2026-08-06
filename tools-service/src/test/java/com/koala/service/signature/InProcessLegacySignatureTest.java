package com.koala.service.signature;

import com.koala.data.models.kugou.key.KugouKeyDataModel;
import com.koala.data.models.kugou.signature.KugouSignatureDataModel;
import com.koala.service.utils.AcwUtils;
import com.koala.service.utils.CryptoUtil;
import com.koala.service.utils.KugouKeyUtil;
import com.koala.service.utils.KugouSignatureUtil;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class InProcessLegacySignatureTest {
    @Test
    void generatesKugouSignatureAndKeyWithoutHttp() throws IOException {
        KugouSignatureDataModel signature = KugouSignatureUtil.encrypt("abc");
        KugouKeyDataModel key = KugouKeyUtil.encrypt("abc");

        assertEquals("900150983cd24fb0d6963f7d28e17f72", signature.getSignature());
        assertEquals("900150983cd24fb0d6963f7d28e17f72", key.getKey());
        assertEquals("abc", signature.getParams());
        assertEquals("abc", key.getParams());
    }

    @Test
    void calculatesLanzouAcwWithoutJavascriptService() {
        String arg1 = "0123456789abcdef0123456789abcdef01234567";
        assertEquals("d2c7186598ab1a508a4f6064e4fa746323ab17c6", AcwUtils.calculate(arg1));
    }

    @Test
    void generatesNeteaseWeapiAndEapiPayloadsLocally() {
        String[] weapi = CryptoUtil.weapiEncrypt("{\"id\":123456}");

        assertFalse(weapi[0].isBlank());
        assertEquals(256, weapi[1].length());
        assertFalse(CryptoUtil.eapiEncrypt("/api/song/enhance/player/url", "{\"id\":123456}").isBlank());
        assertFalse(CryptoUtil.linuxApiEncrypt("{\"method\":\"POST\"}").isBlank());
    }
}
