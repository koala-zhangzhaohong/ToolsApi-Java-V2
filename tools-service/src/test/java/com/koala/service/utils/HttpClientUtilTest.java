package com.koala.service.utils;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HttpClientUtilTest {

    private HttpServer upstream;
    private String baseUrl;

    @TempDir
    Path tempDir;

    @BeforeEach
    void startServer() throws Exception {
        upstream = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + upstream.getAddress().getPort();
        upstream.start();
    }

    @AfterEach
    void stopServer() {
        upstream.stop(0);
    }

    @Test
    void encodesQueryAndReturnsStatusBodyAndHeaders() throws Exception {
        upstream.createContext("/get", exchange -> {
            assertEquals("GET", exchange.getRequestMethod());
            assertEquals("keyword=%E4%B8%AD%E6%96%87%20value", exchange.getRequestURI().getRawQuery());
            assertEquals("test-client", exchange.getRequestHeaders().getFirst("X-Client"));
            byte[] body = "ok".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("X-Upstream", "one");
            exchange.getResponseHeaders().add("X-Upstream", "two");
            exchange.sendResponseHeaders(201, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        HttpClientUtil.HttpResult result = HttpClientUtil.getResponse(
                baseUrl + "/get",
                Map.of("X-Client", "test-client"),
                Map.of("keyword", "中文 value"));

        assertEquals(201, result.statusCode());
        assertEquals("ok", result.body());
        assertEquals(List.of("one", "two"), result.headerValues("x-upstream"));
        assertEquals("中文 value", HttpClientUtil.getParam(
                baseUrl + "/get?keyword=%E4%B8%AD%E6%96%87%20value&flag", "keyword"));
    }

    @Test
    void sendsUtf8FormAndJsonBodies() throws Exception {
        upstream.createContext("/form", exchange -> {
            assertTrue(exchange.getRequestHeaders().getFirst("Content-Type")
                    .startsWith("application/x-www-form-urlencoded"));
            byte[] requestBody = exchange.getRequestBody().readAllBytes();
            byte[] responseBody = requestBody;
            exchange.sendResponseHeaders(200, responseBody.length);
            exchange.getResponseBody().write(responseBody);
            exchange.close();
        });
        upstream.createContext("/json", exchange -> {
            assertTrue(exchange.getRequestHeaders().getFirst("Content-Type").startsWith("application/json"));
            byte[] requestBody = exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(202, requestBody.length);
            exchange.getResponseBody().write(requestBody);
            exchange.close();
        });

        assertEquals("name=%E6%B5%8B%E8%AF%95+value",
                HttpClientUtil.postFormResponse(baseUrl + "/form", null, Map.of("name", "测试 value")).body());
        HttpClientUtil.HttpResult json = HttpClientUtil.postJsonResponse(baseUrl + "/json", null, "{\"ok\":true}");
        assertEquals(202, json.statusCode());
        assertEquals("{\"ok\":true}", json.body());
    }

    @Test
    void capturesCookiesAndResolvesRelativeRedirects() throws Exception {
        upstream.createContext("/cookie", exchange -> {
            exchange.getResponseHeaders().add("Set-Cookie", "ttwid=abc; Path=/; HttpOnly");
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
        });
        upstream.createContext("/redirect/start", exchange -> {
            exchange.getResponseHeaders().set("Location", "../target?id=1");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });

        assertEquals("ttwid", HttpClientUtil.doGetCookie(baseUrl + "/cookie").getFirst().getName());
        assertEquals(baseUrl + "/target?id=1", HttpClientUtil.doGetRedirectLocation(baseUrl + "/redirect/start"));
    }

    @Test
    void supportsPatchHeadOptionsAndBinaryResponses() throws Exception {
        upstream.createContext("/methods", exchange -> {
            String response = exchange.getRequestMethod() + ":"
                    + new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Allow", "GET,HEAD,OPTIONS,PATCH");
            if ("HEAD".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
            } else {
                byte[] body = response.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
            exchange.close();
        });
        byte[] binary = new byte[]{0, 1, 2, 3, -1};
        upstream.createContext("/binary", exchange -> {
            exchange.sendResponseHeaders(200, binary.length);
            exchange.getResponseBody().write(binary);
            exchange.close();
        });

        assertEquals("PATCH:{\"name\":\"value\"}",
                HttpClientUtil.patchJsonResponse(baseUrl + "/methods", null, "{\"name\":\"value\"}").body());
        assertEquals(204, HttpClientUtil.headResponse(baseUrl + "/methods", null, null).statusCode());
        assertEquals("GET,HEAD,OPTIONS,PATCH",
                HttpClientUtil.optionsResponse(baseUrl + "/methods", null, null).firstHeader("Allow"));
        assertArrayEquals(binary, HttpClientUtil.getBytesResponse(baseUrl + "/binary", null, null).body());
    }

    @Test
    void sendsMultipartTextAndFileParts() throws Exception {
        Path file = tempDir.resolve("sample.txt");
        Files.writeString(file, "file-content", StandardCharsets.UTF_8);
        upstream.createContext("/multipart", exchange -> {
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            byte[] responseBody = requestBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, responseBody.length);
            exchange.getResponseBody().write(responseBody);
            exchange.close();
        });

        String body = HttpClientUtil.postMultipartResponse(
                baseUrl + "/multipart", null, Map.of("description", "中文说明"), Map.of("file", file)).body();

        assertTrue(body.contains("name=\"description\""));
        assertTrue(body.contains("中文说明"));
        assertTrue(body.contains("name=\"file\"; filename=\"sample.txt\""));
        assertTrue(body.contains("file-content"));
    }

    @Test
    void returnsResponseBodyTogetherWithCookies() throws Exception {
        upstream.createContext("/cookie-response", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.getResponseHeaders().add("Set-Cookie", "session=token; Path=/");
            byte[] body = "created".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(201, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        HttpClientUtil.CookieResult result = HttpClientUtil.postFormResponseWithCookies(
                baseUrl + "/cookie-response", null, Map.of("name", "value"));

        assertEquals(201, result.response().statusCode());
        assertEquals("created", result.response().body());
        assertEquals("session", result.cookies().getFirst().getName());
    }
}
