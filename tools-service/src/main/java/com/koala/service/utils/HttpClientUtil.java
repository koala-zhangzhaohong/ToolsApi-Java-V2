package com.koala.service.utils;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.hc.client5.http.classic.methods.HttpUriRequestBase;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.cookie.BasicCookieStore;
import org.apache.hc.client5.http.cookie.Cookie;
import org.apache.hc.client5.http.entity.UrlEncodedFormEntity;
import org.apache.hc.client5.http.entity.mime.MultipartEntityBuilder;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.protocol.HttpClientContext;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.HttpResponse;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import org.apache.hc.core5.net.URIBuilder;
import org.apache.hc.core5.util.TimeValue;
import org.apache.hc.core5.util.Timeout;
import org.springframework.util.ObjectUtils;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * 项目唯一的出站 HTTP 客户端。
 *
 * <p>底层统一使用 Apache HttpClient 5 和共享连接池。普通文本/JSON 请求会读取响应体，
 * 媒体与下载请求通过 {@link #doRelay} 使用固定缓冲区流式转发，不缓存完整文件。</p>
 */
public final class HttpClientUtil {

    public enum TimeoutMode {
        DEFAULT,
        QUICK,
        NONE
    }

    public record HttpResult(int statusCode, String body, Map<String, List<String>> headers) {
        public HttpResult {
            body = body == null ? "" : body;
            headers = immutableHeaders(headers);
        }

        public List<String> headerValues(String name) {
            return findHeaderValues(headers, name);
        }

        public String firstHeader(String name) {
            List<String> values = headerValues(name);
            return values.isEmpty() ? null : values.getFirst();
        }

        public boolean isSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }
    }

    /** 用于图片等小型二进制响应；大文件和媒体必须使用 {@link #doRelay}。 */
    public record BinaryResult(int statusCode, byte[] body, Map<String, List<String>> headers) {
        public BinaryResult {
            body = body == null ? new byte[0] : body.clone();
            headers = immutableHeaders(headers);
        }

        @Override
        public byte[] body() {
            return body.clone();
        }

        public List<String> headerValues(String name) {
            return findHeaderValues(headers, name);
        }

        public String firstHeader(String name) {
            List<String> values = headerValues(name);
            return values.isEmpty() ? null : values.getFirst();
        }

        public boolean isSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }
    }

    /** 同时返回响应内容和服务端写入的 Cookie。 */
    public record CookieResult(HttpResult response, List<Cookie> cookies) {
        public CookieResult {
            response = Objects.requireNonNull(response, "response");
            cookies = cookies == null ? List.of() : List.copyOf(cookies);
        }
    }

    private static final Timeout CONNECTION_TIMEOUT = Timeout.ofSeconds(30);
    private static final Timeout RESPONSE_TIMEOUT = Timeout.ofMinutes(3);
    private static final Timeout QUICK_RESPONSE_TIMEOUT = Timeout.ofSeconds(10);
    private static final Timeout POOL_TIMEOUT = Timeout.ofSeconds(30);
    private static final int STREAM_BUFFER_SIZE = 64 * 1024;
    private static final long DEFAULT_RELAY_RANGE_WINDOW = 512L * 1024;

    private static final PoolingHttpClientConnectionManager CONNECTION_MANAGER =
            PoolingHttpClientConnectionManagerBuilder.create()
                    .setMaxConnTotal(200)
                    .setMaxConnPerRoute(50)
                    .setDefaultConnectionConfig(ConnectionConfig.custom()
                            .setConnectTimeout(CONNECTION_TIMEOUT)
                            .setSocketTimeout(Timeout.DISABLED)
                            .setValidateAfterInactivity(TimeValue.ofSeconds(30))
                            .build())
                    .build();

    private static final CloseableHttpClient CLIENT = HttpClients.custom()
            .setConnectionManager(CONNECTION_MANAGER)
            .evictExpiredConnections()
            .evictIdleConnections(TimeValue.ofMinutes(1))
            .build();

    private HttpClientUtil() {
    }

    public static HttpResult getResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("GET", url, headers, params, null, null, TimeoutMode.DEFAULT, true);
    }

    public static HttpResult getResponseWithoutRedirects(String url,
                                                         Map<String, String> headers,
                                                         Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("GET", url, headers, params, null, null, TimeoutMode.DEFAULT, false);
    }

    public static HttpResult getResponseWithoutTimeout(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("GET", url, headers, params, null, null, TimeoutMode.NONE, true);
    }

    public static HttpResult getResponseQuick(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("GET", url, headers, params, null, null, TimeoutMode.QUICK, true);
    }

    public static HttpResult postFormResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException {
        return postFormResponse(url, headers, params, TimeoutMode.DEFAULT);
    }

    public static HttpResult postFormResponse(String url,
                                              Map<String, String> headers,
                                              Map<String, ?> params,
                                              TimeoutMode timeoutMode) throws IOException {
        try {
            return executeWithEntity("POST", url, headers, null, formEntity(params), timeoutMode, true);
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid request URI: " + url, exception);
        }
    }

    public static HttpResult postFormResponseWithoutRedirects(String url,
                                                              Map<String, String> headers,
                                                              Map<String, ?> params) throws IOException {
        try {
            return executeWithEntity("POST", url, headers, null, formEntity(params),
                    TimeoutMode.DEFAULT, false);
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid request URI: " + url, exception);
        }
    }

    public static HttpResult postJsonResponse(String url, Map<String, String> headers, String json)
            throws IOException {
        return postJsonResponse(url, headers, json, TimeoutMode.DEFAULT);
    }

    public static HttpResult postJsonResponse(String url, Map<String, String> headers, String json, TimeoutMode timeoutMode)
            throws IOException {
        try {
            return executeWithEntity("POST", url, headers, null, jsonEntity(json), timeoutMode, true);
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid request URI: " + url, exception);
        }
    }

    public static HttpResult putFormResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException {
        return entityResponse("PUT", url, headers, formEntity(params), TimeoutMode.DEFAULT);
    }

    public static HttpResult putJsonResponse(String url, Map<String, String> headers, String json)
            throws IOException {
        return entityResponse("PUT", url, headers, jsonEntity(json), TimeoutMode.DEFAULT);
    }

    public static HttpResult patchFormResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException {
        return entityResponse("PATCH", url, headers, formEntity(params), TimeoutMode.DEFAULT);
    }

    public static HttpResult patchJsonResponse(String url, Map<String, String> headers, String json)
            throws IOException {
        return entityResponse("PATCH", url, headers, jsonEntity(json), TimeoutMode.DEFAULT);
    }

    public static HttpResult deleteResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("DELETE", url, headers, params, null, null, TimeoutMode.DEFAULT, true);
    }

    public static HttpResult headResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("HEAD", url, headers, params, null, null, TimeoutMode.DEFAULT, true);
    }

    public static HttpResult optionsResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return execute("OPTIONS", url, headers, params, null, null, TimeoutMode.DEFAULT, true);
    }

    public static HttpResult postMultipartResponse(String url,
                                                   Map<String, String> headers,
                                                   Map<String, ?> textParts,
                                                   Map<String, Path> fileParts) throws IOException {
        MultipartEntityBuilder builder = MultipartEntityBuilder.create().setCharset(StandardCharsets.UTF_8);
        if (!ObjectUtils.isEmpty(textParts)) {
            textParts.forEach((name, value) -> {
                if (value != null) builder.addTextBody(
                        name, String.valueOf(value), ContentType.TEXT_PLAIN.withCharset(StandardCharsets.UTF_8));
            });
        }
        if (!ObjectUtils.isEmpty(fileParts)) {
            fileParts.forEach((name, path) -> {
                if (path != null) builder.addBinaryBody(name, path.toFile(), ContentType.DEFAULT_BINARY,
                        path.getFileName().toString());
            });
        }
        return entityResponse("POST", url, headers, builder.build(), TimeoutMode.DEFAULT);
    }

    /** 仅适合小型二进制响应；媒体和下载请使用 {@link #doRelay}。 */
    public static BinaryResult getBytesResponse(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        HttpUriRequestBase request = request("GET", buildUri(url, params), headers, TimeoutMode.DEFAULT, true);
        return executeBytes(request);
    }

    public static HttpResult execute(String method,
                                     String url,
                                     Map<String, String> headers,
                                     Map<String, ?> queryParams,
                                     String body,
                                     ContentType contentType,
                                     TimeoutMode timeoutMode,
                                     boolean followRedirects) throws IOException, URISyntaxException {
        HttpUriRequestBase request = request(method, buildUri(url, queryParams), headers, timeoutMode, followRedirects);
        if (body != null) {
            request.setEntity(new StringEntity(body, contentType == null ? ContentType.TEXT_PLAIN : contentType));
        }
        return execute(request);
    }

    public static List<Cookie> doGetCookie(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return getResponseWithCookies(url, headers, params).cookies();
    }

    public static CookieResult getResponseWithCookies(String url,
                                                      Map<String, String> headers,
                                                      Map<String, ?> params)
            throws IOException, URISyntaxException {
        HttpUriRequestBase request = request("GET", buildUri(url, params), headers, TimeoutMode.DEFAULT, true);
        return executeWithCookies(request);
    }

    public static CookieResult postFormResponseWithCookies(String url,
                                                           Map<String, String> headers,
                                                           Map<String, ?> params) throws IOException {
        return cookieEntityResponse("POST", url, headers, formEntity(params));
    }

    public static CookieResult postJsonResponseWithCookies(String url,
                                                           Map<String, String> headers,
                                                           String json) throws IOException {
        return cookieEntityResponse("POST", url, headers, jsonEntity(json));
    }

    public static List<Cookie> doGetCookie(String url, Map<String, ?> params) throws IOException, URISyntaxException {
        return doGetCookie(url, null, params);
    }

    public static List<Cookie> doGetCookie(String url) throws IOException, URISyntaxException {
        return doGetCookie(url, null, null);
    }

    public static String doGet(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return getResponse(url, headers, params).body();
    }

    public static String doGetWithoutTimeout(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return getResponseWithoutTimeout(url, headers, params).body();
    }

    public static String doGet(String url, Map<String, ?> params) throws IOException, URISyntaxException {
        return doGet(url, null, params);
    }

    public static String doGet(String url) throws IOException, URISyntaxException {
        return doGet(url, null, null);
    }

    public static String doPost(String url, Map<String, String> headers, Map<String, ?> params) throws IOException {
        return postFormResponse(url, headers, params).body();
    }

    public static String doPost(String url, Map<String, ?> params) throws IOException {
        return doPost(url, null, params);
    }

    public static String doPost(String url) throws IOException {
        return doPost(url, null, null);
    }

    public static String doPostJson(String url, Map<String, String> headers, String json) throws IOException {
        return postJsonResponse(url, headers, json).body();
    }

    public static String doPostJson(String url, String json) throws IOException {
        return doPostJson(url, null, json);
    }

    public static String doPostWithoutTimeout(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException {
        return postFormResponse(url, headers, params, TimeoutMode.NONE).body();
    }

    public static String doPostJsonWithoutTimeout(String url, Map<String, String> headers, String json)
            throws IOException {
        return postJsonResponse(url, headers, json, TimeoutMode.NONE).body();
    }

    public static List<Cookie> doPostJsonAndReturnCookie(String url, Map<String, String> headers, String json)
            throws IOException {
        return postJsonResponseWithCookies(url, headers, json).cookies();
    }

    public static List<Cookie> doPostJsonAndReturnCookie(String url, String json) throws IOException {
        return doPostJsonAndReturnCookie(url, null, json);
    }

    public static String doPut(String url, Map<String, String> headers, Map<String, ?> params) throws IOException {
        return putFormResponse(url, headers, params).body();
    }

    public static String doPut(String url, Map<String, ?> params) throws IOException {
        return doPut(url, null, params);
    }

    public static String doPut(String url) throws IOException {
        return doPut(url, null, null);
    }

    public static String doPutJson(String url, Map<String, String> headers, String json) throws IOException {
        return putJsonResponse(url, headers, json).body();
    }

    public static String doPatch(String url, Map<String, String> headers, Map<String, ?> params) throws IOException {
        return patchFormResponse(url, headers, params).body();
    }

    public static String doPatchJson(String url, Map<String, String> headers, String json) throws IOException {
        return patchJsonResponse(url, headers, json).body();
    }

    public static String doDelete(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        return deleteResponse(url, headers, params).body();
    }

    public static String doDelete(String url, Map<String, ?> params) throws IOException, URISyntaxException {
        return doDelete(url, null, params);
    }

    public static String doDelete(String url) throws IOException, URISyntaxException {
        return doDelete(url, null, null);
    }

    public static String doGetRedirectLocation(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        URI requestUri = buildUri(url, params);
        HttpUriRequestBase request = request("GET", requestUri, headers, TimeoutMode.DEFAULT, false);
        return CLIENT.execute(request, response -> {
            EntityUtils.consume(response.getEntity());
            Header location = response.getFirstHeader("Location");
            if (location == null || ObjectUtils.isEmpty(location.getValue())) return null;
            return requestUri.resolve(location.getValue()).toString();
        });
    }

    public static String doGetRedirectLocation(String url, Map<String, ?> params) throws IOException, URISyntaxException {
        return doGetRedirectLocation(url, null, params);
    }

    public static String doGetRedirectLocation(String url) throws IOException, URISyntaxException {
        return doGetRedirectLocation(url, null, null);
    }

    public static int doGetResponseCode(String url, Map<String, String> headers, Map<String, ?> params)
            throws IOException, URISyntaxException {
        HttpUriRequestBase request = request("GET", buildUri(url, params), headers, TimeoutMode.DEFAULT, false);
        return CLIENT.execute(request, response -> {
            EntityUtils.consume(response.getEntity());
            return response.getCode();
        });
    }

    public static int doGetResponseCode(String url, Map<String, ?> params) throws IOException, URISyntaxException {
        return doGetResponseCode(url, null, params);
    }

    public static int doGetResponseCode(String url) throws IOException, URISyntaxException {
        return doGetResponseCode(url, null, null);
    }

    public static void doRelay(String url,
                               Map<String, String> headers,
                               Map<String, ?> params,
                               Integer successCode,
                               Map<String, String> responseHeaders,
                               HttpServletRequest request,
                               HttpServletResponse response) throws IOException, URISyntaxException {
        doRelay(url, headers, params, successCode, responseHeaders, request, response,
                DEFAULT_RELAY_RANGE_WINDOW);
    }

    public static void doRelay(String url,
                               Map<String, String> headers,
                               Map<String, ?> params,
                               Integer successCode,
                               Map<String, String> responseHeaders,
                               HttpServletRequest request,
                               HttpServletResponse response,
                               Long maxOpenRangeBytes) throws IOException, URISyntaxException {
        HttpUriRequestBase upstreamRequest = request(
                "GET", buildUri(url, params), relayHeaders(headers, request, maxOpenRangeBytes), TimeoutMode.NONE, true, false);

        CLIENT.execute(upstreamRequest, upstream -> {
            HttpEntity entity = upstream.getEntity();
            int upstreamStatus = upstream.getCode();
            boolean successful = upstreamStatus >= 200 && upstreamStatus < 300;
            boolean relayable = successful || upstreamStatus == 304 || upstreamStatus == 416
                    || Objects.equals(upstreamStatus, successCode);
            if (!relayable) {
                response.sendError(upstreamStatus);
                EntityUtils.consume(entity);
                return null;
            }

            response.setStatus(upstreamStatus);
            for (String header : List.of("Content-Range", "Accept-Ranges", "Content-Type", "Content-Encoding",
                    "Content-Disposition", "ETag", "Last-Modified", "Cache-Control", "Expires", "Vary")) {
                copyResponseHeader(upstream, response, header);
            }
            if (!response.containsHeader("Accept-Ranges")) response.setHeader("Accept-Ranges", "bytes");
            if (!response.containsHeader("X-Accel-Buffering")) response.setHeader("X-Accel-Buffering", "no");
            if (successful && !ObjectUtils.isEmpty(responseHeaders)) responseHeaders.forEach(response::setHeader);
            if (entity == null) return null;

            long contentLength = entity.getContentLength();
            if (contentLength >= 0) response.setContentLengthLong(contentLength);
            response.setBufferSize(STREAM_BUFFER_SIZE);
            try (InputStream inputStream = entity.getContent(); ServletOutputStream outputStream = response.getOutputStream()) {
                byte[] buffer = new byte[STREAM_BUFFER_SIZE];
                int length;
                while ((length = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, length);
                    // Force the servlet container to touch the client socket for every
                    // streamed chunk. Without this flush a cancelled segmented download
                    // can remain hidden behind response buffering while the server keeps
                    // draining the CDN response and wasting bandwidth.
                    outputStream.flush();
                }
            } catch (IOException | RuntimeException disconnected) {
                // Cancelling the Apache request closes the upstream CDN connection at
                // once. Do not consume the remaining entity after the downstream client
                // has paused/cancelled the transfer.
                upstreamRequest.cancel();
                throw disconnected;
            }
            return null;
        });
    }

    public static void doRelay(String url,
                               Map<String, ?> params,
                               Integer successCode,
                               Map<String, String> responseHeader,
                               HttpServletRequest request,
                               HttpServletResponse response) throws IOException, URISyntaxException {
        doRelay(url, null, params, successCode, responseHeader, request, response);
    }

    public static void doRelay(String url,
                               Integer successCode,
                               Map<String, String> responseHeader,
                               HttpServletRequest request,
                               HttpServletResponse response) throws IOException, URISyntaxException {
        doRelay(url, null, null, successCode, responseHeader, request, response);
    }

    public static String getParam(String url, String name) {
        if (url == null || name == null || !url.contains("?")) return null;
        try {
            return new URIBuilder(url).getQueryParams().stream()
                    .filter(param -> name.equals(param.getName()))
                    .map(NameValuePair::getValue)
                    .findFirst()
                    .orElse(null);
        } catch (URISyntaxException exception) {
            return null;
        }
    }

    private static HttpResult execute(HttpUriRequestBase request) throws IOException {
        return CLIENT.execute(request, response -> {
            HttpEntity entity = response.getEntity();
            String body = entity == null ? "" : EntityUtils.toString(entity, StandardCharsets.UTF_8);
            return new HttpResult(response.getCode(), body, responseHeaders(response));
        });
    }

    private static BinaryResult executeBytes(HttpUriRequestBase request) throws IOException {
        return CLIENT.execute(request, response -> {
            HttpEntity entity = response.getEntity();
            byte[] body = entity == null ? new byte[0] : EntityUtils.toByteArray(entity);
            return new BinaryResult(response.getCode(), body, responseHeaders(response));
        });
    }

    private static CookieResult executeWithCookies(HttpUriRequestBase request) throws IOException {
        BasicCookieStore cookieStore = new BasicCookieStore();
        HttpClientContext context = HttpClientContext.create();
        context.setCookieStore(cookieStore);
        HttpResult response = CLIENT.execute(request, context, upstream -> {
            HttpEntity entity = upstream.getEntity();
            String body = entity == null ? "" : EntityUtils.toString(entity, StandardCharsets.UTF_8);
            return new HttpResult(upstream.getCode(), body, responseHeaders(upstream));
        });
        return new CookieResult(response, cookieStore.getCookies());
    }

    private static HttpResult entityResponse(String method,
                                             String url,
                                             Map<String, String> headers,
                                             HttpEntity entity,
                                             TimeoutMode timeoutMode) throws IOException {
        try {
            return executeWithEntity(method, url, headers, null, entity, timeoutMode, true);
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid request URI: " + url, exception);
        }
    }

    private static CookieResult cookieEntityResponse(String method,
                                                     String url,
                                                     Map<String, String> headers,
                                                     HttpEntity entity) throws IOException {
        try {
            HttpUriRequestBase request = request(
                    method, buildUri(url, null), headers, TimeoutMode.DEFAULT, true);
            request.setEntity(entity);
            return executeWithCookies(request);
        } catch (URISyntaxException exception) {
            throw new IOException("Invalid request URI: " + url, exception);
        }
    }

    private static HttpResult executeWithEntity(String method,
                                                String url,
                                                Map<String, String> headers,
                                                Map<String, ?> queryParams,
                                                HttpEntity entity,
                                                TimeoutMode timeoutMode,
                                                boolean followRedirects) throws IOException, URISyntaxException {
        HttpUriRequestBase request = request(
                method, buildUri(url, queryParams), headers, timeoutMode, followRedirects);
        request.setEntity(entity);
        return execute(request);
    }

    private static HttpUriRequestBase request(String method,
                                              URI uri,
                                              Map<String, String> headers,
                                              TimeoutMode timeoutMode,
                                              boolean followRedirects) {
        return request(method, uri, headers, timeoutMode, followRedirects, true);
    }

    private static HttpUriRequestBase request(String method,
                                              URI uri,
                                              Map<String, String> headers,
                                              TimeoutMode timeoutMode,
                                              boolean followRedirects,
                                              boolean contentCompression) {
        if (method == null || method.isBlank()) throw new IllegalArgumentException("HTTP method is required");
        Objects.requireNonNull(uri, "uri");
        HttpUriRequestBase request = new HttpUriRequestBase(method.toUpperCase(Locale.ROOT), uri);
        request.setConfig(requestConfig(timeoutMode, followRedirects, contentCompression));
        if (!ObjectUtils.isEmpty(headers)) headers.forEach(request::setHeader);
        return request;
    }

    private static RequestConfig requestConfig(TimeoutMode timeoutMode,
                                               boolean followRedirects,
                                               boolean contentCompression) {
        RequestConfig.Builder builder = RequestConfig.custom()
                .setRedirectsEnabled(followRedirects)
                .setContentCompressionEnabled(contentCompression);
        if (timeoutMode == TimeoutMode.NONE) {
            // Timeout.DISABLED is represented as zero for connection-pool leasing in
            // HttpClient 5, which makes concurrent Range requests fail immediately
            // with ConnectionRequestTimeoutException. Streaming responses may have
            // no read deadline, but they must still wait for an available connection.
            builder.setConnectionRequestTimeout(POOL_TIMEOUT).setResponseTimeout(Timeout.DISABLED);
        } else if (timeoutMode == TimeoutMode.QUICK) {
            builder.setConnectionRequestTimeout(POOL_TIMEOUT).setResponseTimeout(QUICK_RESPONSE_TIMEOUT);
        } else {
            builder.setConnectionRequestTimeout(POOL_TIMEOUT).setResponseTimeout(RESPONSE_TIMEOUT);
        }
        return builder.build();
    }

    private static URI buildUri(String url, Map<String, ?> params) throws URISyntaxException {
        URIBuilder builder = new URIBuilder(url);
        if (!ObjectUtils.isEmpty(params)) {
            params.forEach((key, value) -> {
                if (value != null) builder.setParameter(key, String.valueOf(value));
            });
        }
        return builder.build();
    }

    private static HttpEntity formEntity(Map<String, ?> params) {
        List<NameValuePair> pairs = new ArrayList<>();
        if (!ObjectUtils.isEmpty(params)) {
            params.forEach((key, value) -> {
                if (value != null) pairs.add(new BasicNameValuePair(key, String.valueOf(value)));
            });
        }
        return new UrlEncodedFormEntity(pairs, StandardCharsets.UTF_8);
    }

    private static HttpEntity jsonEntity(String json) {
        return new StringEntity(Objects.requireNonNullElse(json, ""), ContentType.APPLICATION_JSON);
    }

    private static Map<String, String> relayHeaders(Map<String, String> configured, HttpServletRequest request) {
        return relayHeaders(configured, request, null);
    }

    private static Map<String, String> relayHeaders(Map<String, String> configured,
                                                     HttpServletRequest request,
                                                     Long maxOpenRangeBytes) {
        Map<String, String> headers = new LinkedHashMap<>();
        if (!ObjectUtils.isEmpty(configured)) headers.putAll(configured);
        String range = request.getHeader("Range");
        if (!ObjectUtils.isEmpty(range)) {
            if (maxOpenRangeBytes != null && maxOpenRangeBytes > 0) {
                java.util.regex.Matcher openRange = java.util.regex.Pattern
                        .compile("^bytes=(\\d+)-$").matcher(range.trim());
                if (openRange.matches()) {
                    long start = Long.parseLong(openRange.group(1));
                    long limitedEnd = Math.addExact(start, maxOpenRangeBytes - 1);
                    range = "bytes=" + start + "-" + limitedEnd;
                }
            }
            headers.put("Range", range);
            // Compressed transfer coding makes byte offsets ambiguous and breaks chunk merging.
            headers.put("Accept-Encoding", "identity");
        } else if (!headers.containsKey("Range")) {
            headers.remove("Range");
        }
        for (String name : List.of("Accept", "Accept-Language", "Cache-Control", "If-Match",
                "If-Modified-Since", "If-None-Match", "If-Range", "If-Unmodified-Since", "User-Agent")) {
            String value = request.getHeader(name);
            if (!ObjectUtils.isEmpty(value)) headers.putIfAbsent(name, value);
        }
        return headers;
    }

    private static void copyResponseHeader(HttpResponse upstream, HttpServletResponse response, String name) {
        Header header = upstream.getFirstHeader(name);
        if (header != null && !ObjectUtils.isEmpty(header.getValue())) response.setHeader(name, header.getValue());
    }

    private static Map<String, List<String>> responseHeaders(HttpResponse response) {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        for (Header header : response.getHeaders()) {
            headers.computeIfAbsent(header.getName(), ignored -> new ArrayList<>()).add(header.getValue());
        }
        return headers;
    }

    private static Map<String, List<String>> immutableHeaders(Map<String, List<String>> source) {
        if (source == null || source.isEmpty()) return Map.of();
        Map<String, List<String>> copy = new LinkedHashMap<>();
        source.forEach((name, values) -> copy.put(name, List.copyOf(values)));
        return Collections.unmodifiableMap(copy);
    }

    private static List<String> findHeaderValues(Map<String, List<String>> headers, String name) {
        if (name == null || headers == null) return List.of();
        return headers.entrySet().stream()
                .filter(entry -> entry.getKey().equalsIgnoreCase(name))
                .findFirst()
                .map(Map.Entry::getValue)
                .orElse(List.of());
    }
}
