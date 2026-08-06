package com.koala.service.utils;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class HttpClientUtilRelayTest {

    @Test
    void relaysRequestedByteRangeAndPartialResponseHeaders() throws Exception {
        byte[] source = "0123456789abcdefghijklmnopqrstuvwxyz".getBytes(StandardCharsets.UTF_8);
        HttpServer upstream = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        upstream.createContext("/file", exchange -> {
            assertEquals("bytes=10-19", exchange.getRequestHeaders().getFirst("Range"));
            byte[] part = Arrays.copyOfRange(source, 10, 20);
            exchange.getResponseHeaders().set("Accept-Ranges", "bytes");
            exchange.getResponseHeaders().set("Content-Type", "application/octet-stream");
            exchange.getResponseHeaders().set("Content-Range", "bytes 10-19/" + source.length);
            exchange.sendResponseHeaders(206, part.length);
            exchange.getResponseBody().write(part);
            exchange.close();
        });
        upstream.start();

        try {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Range", "bytes=10-19");
            MockHttpServletResponse response = new MockHttpServletResponse();

            HttpClientUtil.doRelay(
                    "http://127.0.0.1:" + upstream.getAddress().getPort() + "/file",
                    Map.of("Range", "bytes=0-"),
                    null,
                    206,
                    Map.of("Content-Disposition", "attachment; filename=test.bin"),
                    request,
                    response
            );

            assertEquals(206, response.getStatus());
            assertEquals("bytes", response.getHeader("Accept-Ranges"));
            assertEquals("bytes 10-19/" + source.length, response.getHeader("Content-Range"));
            assertEquals("10", response.getHeader("Content-Length"));
            assertEquals("attachment; filename=test.bin", response.getHeader("Content-Disposition"));
            assertArrayEquals(Arrays.copyOfRange(source, 10, 20), response.getContentAsByteArray());
        } finally {
            upstream.stop(0);
        }
    }
}
