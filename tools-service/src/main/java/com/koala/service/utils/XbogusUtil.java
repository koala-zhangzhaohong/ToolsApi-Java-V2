package com.koala.service.utils;

import com.koala.data.models.xbogus.XbogusDataModel;
import com.koala.service.signature.DouyinSignatureService;

import java.io.IOException;
import java.net.URI;

/**
 * @author koala
 * @version 1.0
 * @date 2023/4/9 11:09
 * @description
 */
public class XbogusUtil {
    private static final DouyinSignatureService SIGNATURE_SERVICE = DouyinSignatureService.getInstance();

    private XbogusUtil() {
    }

    public static XbogusDataModel encrypt(String url) throws IOException {
        try {
            String query = URI.create(url).getRawQuery();
            String signature = SIGNATURE_SERVICE.generateXBogus(query, DouyinSignatureService.USER_AGENT);
            XbogusDataModel result = new XbogusDataModel();
            result.setXbogus(signature);
            result.setMstoken(SIGNATURE_SERVICE.generateMsToken());
            result.setTtwid(SIGNATURE_SERVICE.getTtwid());
            result.setUrl(appendQueryParameter(url, "X-Bogus", signature));
            return result;
        } catch (RuntimeException exception) {
            throw new IOException("Unable to generate X-Bogus in process", exception);
        }
    }

    static String appendQueryParameter(String url, String name, String value) {
        if (url.contains("?")) {
            return url + (url.endsWith("?") || url.endsWith("&") ? "" : "&") + name + "=" + value;
        }
        return url + (url.endsWith("/") ? "?" : "/?") + name + "=" + value;
    }
}
