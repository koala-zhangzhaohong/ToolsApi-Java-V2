package com.koala.service.utils;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class HttpClientUtilRelayTest {

    @Test
    void relaysRequestedByteRangeAndPartialResponseHeaders() throws Exception {
        byte[] source = "0123456789abcdefghijklmnopqrstuvwxyz".getBytes(StandardCharsets.UTF_8);
        HttpServer upstream = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        upstream.createContext("/file", exchange -> {
            assertEquals("bytes=10-19", exchange.getRequestHeaders().getFirst("Range"));
            assertEquals("identity", exchange.getRequestHeaders().getFirst("Accept-Encoding"));
            assertEquals("range-etag", exchange.getRequestHeaders().getFirst("If-Range"));
            assertEquals("https://www.douyin.com/", exchange.getRequestHeaders().getFirst("Referer"));
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
            request.addHeader("If-Range", "range-etag");
            MockHttpServletResponse response = new MockHttpServletResponse();

            HttpClientUtil.doRelay(
                    "http://127.0.0.1:" + upstream.getAddress().getPort() + "/file",
                    Map.of("Range", "bytes=0-", "Accept-Encoding", "gzip",
                            "Referer", "https://www.douyin.com/"),
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

    @Test
    void relaysConcurrentDownloadRangesIndependently() throws Exception {
        byte[] source = new byte[2 * 1024 * 1024];
        for (int index = 0; index < source.length; index++) source[index] = (byte) (index % 251);
        HttpServer upstream = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ExecutorService upstreamExecutor = Executors.newFixedThreadPool(2);
        ExecutorService clients = Executors.newFixedThreadPool(2);
        upstream.setExecutor(upstreamExecutor);
        upstream.createContext("/large-file", exchange -> {
            String range = exchange.getRequestHeaders().getFirst("Range");
            String[] bounds = range.substring("bytes=".length()).split("-");
            int start = Integer.parseInt(bounds[0]);
            int end = Integer.parseInt(bounds[1]);
            byte[] part = Arrays.copyOfRange(source, start, end + 1);
            exchange.getResponseHeaders().set("Accept-Ranges", "bytes");
            exchange.getResponseHeaders().set("Content-Range", "bytes " + start + "-" + end + "/" + source.length);
            exchange.sendResponseHeaders(206, part.length);
            exchange.getResponseBody().write(part);
            exchange.close();
        });
        upstream.start();

        try {
            String url = "http://127.0.0.1:" + upstream.getAddress().getPort() + "/large-file";
            CompletableFuture<MockHttpServletResponse> first = CompletableFuture.supplyAsync(
                    () -> relayRange(url, "bytes=0-1048575"), clients);
            CompletableFuture<MockHttpServletResponse> second = CompletableFuture.supplyAsync(
                    () -> relayRange(url, "bytes=1048576-2097151"), clients);

            MockHttpServletResponse firstResponse = first.get();
            MockHttpServletResponse secondResponse = second.get();
            assertEquals(206, firstResponse.getStatus());
            assertEquals(206, secondResponse.getStatus());
            assertEquals("bytes 0-1048575/2097152", firstResponse.getHeader("Content-Range"));
            assertEquals("bytes 1048576-2097151/2097152", secondResponse.getHeader("Content-Range"));
            assertArrayEquals(Arrays.copyOfRange(source, 0, 1048576), firstResponse.getContentAsByteArray());
            assertArrayEquals(Arrays.copyOfRange(source, 1048576, 2097152), secondResponse.getContentAsByteArray());
        } finally {
            upstream.stop(0);
            clients.shutdownNow();
            upstreamExecutor.shutdownNow();
        }
    }

    private MockHttpServletResponse relayRange(String url, String range) {
        try {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Range", range);
            MockHttpServletResponse response = new MockHttpServletResponse();
            HttpClientUtil.doRelay(url, null, null, 206,
                    Map.of("Content-Disposition", "attachment; filename=media.bin"), request, response);
            return response;
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
