package com.koala.web.service;

import com.koala.service.data.redis.RedisLockUtil;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DistributedScheduledTaskExecutorTest {

    private final RedisLockUtil redisLockUtil = mock(RedisLockUtil.class);
    private final DistributedScheduledTaskExecutor executor =
            new DistributedScheduledTaskExecutor(redisLockUtil);

    @Test
    void runsTaskWhenLeaseIsAcquired() {
        Runnable task = mock(Runnable.class);
        when(redisLockUtil.getLock(
                eq("scheduled-task:lock:token-refresh"), any(), eq(3600)))
                .thenReturn(true);

        boolean executed = executor.runOnce("token-refresh", Duration.ofHours(1), task);

        assertTrue(executed);
        verify(task).run();
    }

    @Test
    void skipsTaskWhenAnotherInstanceOwnsLease() {
        Runnable task = mock(Runnable.class);
        when(redisLockUtil.getLock(
                eq("scheduled-task:lock:token-refresh"), any(), eq(3600)))
                .thenReturn(false);

        boolean executed = executor.runOnce("token-refresh", Duration.ofHours(1), task);

        assertFalse(executed);
        verify(task, never()).run();
    }
}
