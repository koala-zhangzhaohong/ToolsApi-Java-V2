package com.koala.web.config;

import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpHeaders;
import org.apache.hc.core5.http.message.BasicHeader;
import org.springframework.boot.elasticsearch.autoconfigure.Rest5ClientBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;

/**
 * Keeps the Elasticsearch low-level client compatible with clusters that reject
 * Elasticsearch vendor media types in Accept and Content-Type headers.
 */
@Configuration
public class ElasticsearchConfig {

    @Bean
    public Rest5ClientBuilderCustomizer elasticsearchJsonHeadersCustomizer() {
        return builder -> builder.setDefaultHeaders(new Header[]{
                new BasicHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE),
                new BasicHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
        });
    }
}
