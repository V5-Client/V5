const Executors = java.util.concurrent.Executors;
const AtomicInteger = java.util.concurrent.atomic.AtomicInteger;

class ThreadExecutor {
    constructor() {
        this.threadNumber = new AtomicInteger(1);

        this.service = Executors.newCachedThreadPool((runnable) => {
            const thread = new java.lang.Thread(runnable);

            thread.setDaemon(true);
            thread.setName(`V5-Executor-${this.threadNumber.getAndIncrement()}`);

            return thread;
        });

        register('gameUnload', () => {
            this.shutdown();
        });
    }

    /**
     * Offloads a task to a background thread.
     * @param {Function} task - The function to run.
     */
    execute(task) {
        if (this.service.isShutdown() || typeof task !== 'function') return;

        this.service.execute(() => {
            try {
                task();
            } catch (e) {
                console.error(`[V5 Thread Error]:`);
                console.error('V5 Caught error' + e + e.stack);
            }
        });
    }

    /**
     * Shuts down the executor properly.
     */
    shutdown() {
        this.service.shutdownNow();
    }
}

export const Executor = new ThreadExecutor();
