package com.koala.web.config;

import co.elastic.clients.transport.rest5_client.Rest5ClientOptions;
import co.elastic.clients.transport.rest5_client.low_level.RequestOptions;
import co.elastic.clients.transport.rest5_client.low_level.Rest5ClientBuilder;
import org.apache.hc.client5.http.impl.async.HttpAsyncClientBuilder;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpHeaders;
import org.apache.hc.core5.http.message.BasicHeader;
import org.springframework.boot.elasticsearch.autoconfigure.Rest5ClientBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;

/**
 * Keeps the Elasticsearch client compatible with clusters that reject
 * Elasticsearch vendor media types in Accept and Content-Type headers.
 */
@Configuration
public class ElasticsearchConfig {

    private static final String JSON_MEDIA_TYPE = MediaType.APPLICATION_JSON_VALUE;

    @Bean
    public Rest5ClientOptions elasticsearchJsonTransportOptions() {
        RequestOptions requestOptions = RequestOptions.DEFAULT.toBuilder()
                .removeHeader(HttpHeaders.ACCEPT)
                .removeHeader(HttpHeaders.CONTENT_TYPE)
                .addHeader(HttpHeaders.ACCEPT, JSON_MEDIA_TYPE)
                .addHeader(HttpHeaders.CONTENT_TYPE, JSON_MEDIA_TYPE)
                .build();
        return new Rest5ClientOptions(requestOptions, false);
    }

    @Bean
    public Rest5ClientBuilderCustomizer elasticsearchJsonHeadersCustomizer() {
        return new Rest5ClientBuilderCustomizer() {

            @Override
            public void customize(Rest5ClientBuilder builder) {
                builder.setDefaultHeaders(jsonHeaders());
            }

            @Override
            public void customize(HttpAsyncClientBuilder builder) {
                builder.addRequestInterceptorLast((request, entity, context) -> {
                    request.removeHeaders(HttpHeaders.ACCEPT);
                    request.removeHeaders(HttpHeaders.CONTENT_TYPE);
                    request.setHeader(HttpHeaders.ACCEPT, JSON_MEDIA_TYPE);
                    request.setHeader(HttpHeaders.CONTENT_TYPE, JSON_MEDIA_TYPE);
                });
            }
        };
    }

    private Header[] jsonHeaders() {
        return new Header[]{
                new BasicHeader(HttpHeaders.ACCEPT, JSON_MEDIA_TYPE),
                new BasicHeader(HttpHeaders.CONTENT_TYPE, JSON_MEDIA_TYPE)
        };
    }
}
