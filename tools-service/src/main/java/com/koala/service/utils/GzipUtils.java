package com.koala.service.utils;

import org.springframework.http.HttpHeaders;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPInputStream;
import java.nio.charset.StandardCharsets;

public class GzipUtils {
    public static String decodeIfGzip(HttpHeaders headers, byte[] body) throws IOException {
        String contentEncoding = headers != null ?
                headers.getFirst(HttpHeaders.CONTENT_ENCODING) : null;

        if ("gzip".equalsIgnoreCase(contentEncoding)) {
            try (GZIPInputStream gzipIn = new GZIPInputStream(new ByteArrayInputStream(body));
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[1024];
                int len;
                while ((len = gzipIn.read(buffer)) != -1) {
                    out.write(buffer, 0, len);
                }
                return out.toString(StandardCharsets.UTF_8);
            }
        } else {
            return new String(body, StandardCharsets.UTF_8);
        }
    }
}