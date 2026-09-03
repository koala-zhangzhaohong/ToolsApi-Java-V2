package com.koala.service.utils;

import com.koala.data.models.kugou.signature.KugouSignatureDataModel;

import java.io.IOException;

/**
 * @author koala
 * @version 1.0
 * @date 2023/4/9 11:09
 * @description
 */
public class KugouSignatureUtil {
    private KugouSignatureUtil() {
    }

    public static KugouSignatureDataModel encrypt(String paramsData) throws IOException {
        if (paramsData == null) {
            throw new IOException("Kugou signature input must not be null");
        }
        KugouSignatureDataModel result = new KugouSignatureDataModel();
        result.setParams(paramsData);
        result.setSignature(CryptoUtil.getMd5(paramsData));
        return result;
    }
}
