package com.koala.factory.extra.kugou

import com.koala.factory.SecretKey.KugouSecretKeyCollector.KUGOU_ITEM_SECRET_KEY
import com.koala.factory.SecretKey.KugouSecretKeyCollector.KUGOU_PID_VERSION_SECRET_KEY
import com.koala.service.utils.MD5Utils
import java.util.*

class KugouSingnatureGenerator {

    companion object {
        @JvmStatic
        fun generateKugouKey(hash: String?, appId: String?, mid: String?, userId: String?): String {
            return MD5Utils.md5("${hash ?: ""}$KUGOU_PID_VERSION_SECRET_KEY${appId ?: ""}${mid ?: ""}${userId ?: ""}")
        }

        @JvmStatic
        fun generateKugouSignatureV2(params: HashMap<String, String?>?): String? {
            var result = ""
            params?.values?.let {
                result = "$result$KUGOU_ITEM_SECRET_KEY"
                for ((key, value) in params) {
                    result = "$result$key=${value ?: ""}"
                }
                return MD5Utils.md5("$result$KUGOU_ITEM_SECRET_KEY")
            }
            return null
        }

        @JvmStatic
        fun generateKugouSignatureV1(map: MutableMap<String?, String?>?): String? {
            if (map == null) {
                return ""
            }
            val sb = StringBuilder()
            val keySet = map.keys
            val strArr = keySet.toTypedArray<String?>()
            Arrays.sort<String?>(
                strArr,
                Comparator { obj: String?, anotherString: String? -> obj!!.compareTo(anotherString!!) })
            for (str3 in strArr) {
                sb.append(str3)
                sb.append("=")
                sb.append(map[str3])
            }
            return MD5Utils.md5(KUGOU_ITEM_SECRET_KEY + sb + KUGOU_ITEM_SECRET_KEY)
        }
    }

}