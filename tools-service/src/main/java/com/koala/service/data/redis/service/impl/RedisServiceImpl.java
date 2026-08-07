package com.koala.service.data.redis.service.impl;

import com.koala.service.data.redis.service.RedisService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service("RedisService")
public class RedisServiceImpl implements RedisService {

    private final static Long DEFAULT_EXPIRE_TIME = 7 * 24 * 60 * 60L;

    /**
     * prod-local 依赖的 Redis 不可达时，短链和抖音解析仍应能完成本次请求。
     * 该缓存只作为进程内降级存储，Redis 恢复后自动回到远端缓存。
     */
    private final Map<String, String> fallbackCache = new ConcurrentHashMap<>();

    @Resource
    private RedisTemplate<String, Object> redisTemplate;

    @Override
    public String get(String key) {
        return get(key, null);
    }

    @Override
    public String get(String key, String defaultValue) {
        try {
            Object result = redisTemplate.opsForValue().get(key);
            if (!Objects.isNull(result)) {
                return String.valueOf(result);
            }
        } catch (RuntimeException exception) {
            log.warn("Redis unavailable, using local fallback for get({})", key);
        }
        return fallbackCache.getOrDefault(key, defaultValue);
    }

    @Override
    public void set(String key, String value) {
        set(key, value, DEFAULT_EXPIRE_TIME);
    }

    @Override
    public void set(String key, String value, Long expireTime) {
        fallbackCache.put(key, value);
        try {
            redisTemplate.opsForValue().set(key, value, Duration.ofSeconds(expireTime));
        } catch (RuntimeException exception) {
            log.warn("Redis unavailable, using local fallback for set({})", key);
        }
    }

    @Override
    public String getAndPersist(String key) {
        return getAndPersist(key, null);
    }

    @Override
    public String getAndPersist(String key, String defaultValue) {
        try {
            Object result = redisTemplate.opsForValue().getAndPersist(key);
            if (!Objects.isNull(result)) {
                return String.valueOf(result);
            }
        } catch (RuntimeException exception) {
            log.warn("Redis unavailable, using local fallback for getAndPersist({})", key);
        }
        return fallbackCache.getOrDefault(key, defaultValue);
    }
}
