package com.koala.web.service;

import com.koala.service.data.redis.RedisLockUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

/**
 * Ensures that a scheduled task is run by at most one application instance.
 *
 * <p>The Redis key is intentionally not released when the task completes. It is
 * kept for the lease duration so that an instance whose scheduler fires a little
 * later cannot run the same occurrence again.</p>
 */
@Slf4j
@Component
public class DistributedScheduledTaskExecutor {

    private final RedisLockUtil redisLockUtil;

    public DistributedScheduledTaskExecutor(RedisLockUtil redisLockUtil) {
        this.redisLockUtil = redisLockUtil;
    }

    public boolean runOnce(String taskName, Duration leaseDuration, Runnable task) {
        int leaseSeconds = Math.toIntExact(leaseDuration.toSeconds());
        String lockKey = "scheduled-task:lock:" + taskName;
        String lockValue = UUID.randomUUID().toString();

        if (!redisLockUtil.getLock(lockKey, lockValue, leaseSeconds)) {
            log.info("Skip scheduled task because another instance owns the lease: {}", taskName);
            return false;
        }

        log.info("Acquired scheduled task lease, starting task: {}", taskName);
        task.run();
        return true;
    }
}
