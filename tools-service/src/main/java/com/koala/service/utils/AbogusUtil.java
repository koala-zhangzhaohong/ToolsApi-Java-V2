package com.koala.service.utils;

import com.koala.data.models.abogus.AbogusDataModel;
import com.koala.service.signature.DouyinSignatureService;

import java.io.IOException;
import java.net.URI;

/**
 * @author koala
 * @version 1.0
 * @date 2023/4/9 11:09
 * @description
 */
public class AbogusUtil {
    private static final DouyinSignatureService SIGNATURE_SERVICE = DouyinSignatureService.getInstance();

    private AbogusUtil() {
    }

    public static AbogusDataModel encrypt(String url) throws IOException {
        try {
            String query = URI.create(url).getRawQuery();
            String signature = SIGNATURE_SERVICE.generateABogus(query, "");
            AbogusDataModel result = new AbogusDataModel();
            result.setAbogus(signature);
            result.setMstoken(SIGNATURE_SERVICE.generateMsToken());
            result.setTtwid(SIGNATURE_SERVICE.getTtwid());
            result.setUrl(XbogusUtil.appendQueryParameter(url, "a_bogus", signature));
            return result;
        } catch (RuntimeException exception) {
            throw new IOException("Unable to generate A-Bogus in process", exception);
        }
    }
}
