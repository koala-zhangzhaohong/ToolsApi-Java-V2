package com.koala.service.utils;

import com.koala.data.models.kugou.key.KugouKeyDataModel;

import java.io.IOException;

/**
 * @author koala
 * @version 1.0
 * @date 2023/4/9 11:09
 * @description
 */
public class KugouKeyUtil {
    private KugouKeyUtil() {
    }

    public static KugouKeyDataModel encrypt(String paramsData) throws IOException {
        if (paramsData == null) {
            throw new IOException("Kugou key input must not be null");
        }
        KugouKeyDataModel result = new KugouKeyDataModel();
        result.setParams(paramsData);
        result.setKey(CryptoUtil.getMd5(paramsData));
        return result;
    }
}
