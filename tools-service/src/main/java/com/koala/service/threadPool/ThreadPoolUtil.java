package com.koala.service.threadPool;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

@SuppressWarnings("ALL")
public class ThreadPoolUtil<T> {

    private static final Logger logger = LoggerFactory.getLogger(ThreadPoolUtil.class);

    // 使用AtomicReference来存储实例，确保线程安全
    private static final AtomicReference<ThreadPoolUtil> INSTANCE = new AtomicReference<>();

    /**
     * 最大线程数量 使用cpu核心数
     */
    private static final int maximumPoolSize = Runtime.getRuntime().availableProcessors();

    /**
     * 核心线程数
     */
    private static final int corePoolSize = maximumPoolSize / 2;

    /**
     * 空闲时间
     */
    private static final long keepAliveTime = 60;

    /**
     * 单位 秒
     */
    private static final TimeUnit unit = TimeUnit.SECONDS;

    /**
     * 任务队列数量
     */
    private static final BlockingQueue<Runnable> workQueue = new ArrayBlockingQueue<>(1000);

    // 线程池实例
    private final ExecutorService executorService;

    // 私有构造函数
    private ThreadPoolUtil() {
        logger.info("[ThreadPoolUtil] 线程池参数：核心线程数{},最大线程数{},空闲时间{}s,队列大小{}", corePoolSize, maximumPoolSize, keepAliveTime, workQueue.size());
        this.executorService = new ThreadPoolExecutor(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue);
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
        logger.info("[ThreadPoolUtil] 队列任务数量:{}", workQueue.size());
        return executorService.submit(task);
    }

    // 不带返回值 提交任务到线程池
    public void submitTask(Runnable task) {
        executorService.submit(task);
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