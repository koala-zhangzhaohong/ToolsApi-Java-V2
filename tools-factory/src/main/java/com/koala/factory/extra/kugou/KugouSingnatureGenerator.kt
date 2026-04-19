package com.koala.factory.extra.kugou

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
        fun generateKugouSignatureV2(
            secret: String,
            params: MutableMap<String, String?>?
        ): String? {
            var result = ""
            params?.values?.let {
                result = "$result$secret"
                for ((key, value) in params) {
                    result = "$result$key=${value ?: ""}"
                }
                return MD5Utils.md5("$result$secret")
            }
            return null
        }

        @JvmStatic
        fun generateKugouSignatureV1(
            secret: String,
            map: MutableMap<String?, String?>?
        ): String? {
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
            return MD5Utils.md5(secret + sb + secret)
        }

        @JvmStatic
        fun getGetRequestParams(map: MutableMap<String?, String?>?): String {
            if (map == null) {
                return ""
            }
            val sb = java.lang.StringBuilder()
            sb.append("?")
            val keySet = map.keys
            for (str in keySet) {
                sb.append(str)
                sb.append("=")
                sb.append(map.get(str))
                sb.append("&")
            }
            sb.deleteCharAt(sb.length - 1)
            return sb.toString()
        }
    }

}