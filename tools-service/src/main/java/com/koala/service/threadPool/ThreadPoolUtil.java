package com.koala.service.threadPool;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

@SuppressWarnings("ALL")
public class ThreadPoolUtil<T> {

    private static final Logger logger = LoggerFactory.getLogger(ThreadPoolUtil.class);

    // 使用AtomicReference来存储实例，确保线程安全
    private static final AtomicReference<ThreadPoolUtil> INSTANCE = new AtomicReference<>();

    /** 最大线程数量。 */
    private static final int CPU_CORES = Math.max(1, Runtime.getRuntime().availableProcessors());

    /** I/O 型任务需要比 CPU 核心数更高的并发度，但设置上限避免外部接口被打爆。 */
    private static final int maximumPoolSize = Math.min(64, Math.max(16, CPU_CORES * 8));

    /**
     * 核心线程数
     */
    private static final int corePoolSize = Math.min(maximumPoolSize, Math.max(8, CPU_CORES * 2));

    /**
     * 空闲时间
     */
    private static final long keepAliveTime = 60;

    /**
     * 单位 秒
     */
    private static final TimeUnit unit = TimeUnit.SECONDS;

    /** 使用无容量移交队列，让线程池在有任务时快速扩容到 maximumPoolSize。 */
    private static final BlockingQueue<Runnable> workQueue = new SynchronousQueue<>();

    // 线程池实例
    private final ExecutorService executorService;

    // 私有构造函数
    private ThreadPoolUtil() {
        logger.info("[ThreadPoolUtil] 线程池参数：核心线程数{},最大线程数{},空闲时间{}s,队列类型{}", corePoolSize, maximumPoolSize, keepAliveTime, workQueue.getClass().getSimpleName());
        AtomicInteger threadNumber = new AtomicInteger(1);
        ThreadFactory threadFactory = task -> {
            Thread thread = new Thread(task, "tools-io-pool-" + threadNumber.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        this.executorService = new ThreadPoolExecutor(
                corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue, threadFactory,
                new ThreadPoolExecutor.CallerRunsPolicy());
    }

    // 双重检查锁定模式获取实例
    public static ThreadPoolUtil getInstance() {
        ThreadPoolUtil instance = INSTANCE.get();
        if (instance == null) {
            synchronized (ThreadPoolUtil.class) {
                instance = INSTANCE.get();
                if (instance == null) {
                    instance = new ThreadPoolUtil();
                    INSTANCE.set(instance);
                }
            }
        }
        return instance;
    }

    // 带返回值 提交任务到线程池
    public Future<T> submitTask(Callable task) {
        // logger.info("[ThreadPoolUtil] 队列任务数量:{}", workQueue.size());
        return executorService.submit(task);
    }

    // 不带返回值 提交任务到线程池
    public void submitTask(Runnable task) {
        executorService.submit(task);
    }

    public int getWorkQueueSize() {
        return workQueue.size();
    }

    // 关闭线程池
    public void shutdown() {
        executorService.shutdown();
    }

    // 尝试优雅关闭线程池，等待已提交的任务完成
    public void shutdownNow() {
        executorService.shutdownNow();
    }
}
