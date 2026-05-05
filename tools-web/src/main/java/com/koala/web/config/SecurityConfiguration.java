package com.koala.web.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * @author koala
 * @version 1.0
 * @date 2023/5/3 20:24
 * @description
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity()
public class SecurityConfiguration {

    @Bean
    protected SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .headers(headers -> headers
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)
                )
                .csrf(AbstractHttpConfigurer::disable)
                .build();
        // return http.authorizeHttpRequests((authorizeRequests) -> authorizeRequests.anyRequest().permitAll()).csrf().disable().build();
    }

}