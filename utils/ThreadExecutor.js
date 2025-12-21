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
    }

    /**
     * Offloads a task to a background thread.
     * @param {Function} task - The function to run.
     */
    execute(task) {
        this.service.execute(() => {
            try {
                task();
            } catch (err) {
                console.error(`[V5 Thread Error]: ${err}`);
            }
        });
    }

    /**
     * Shuts down the executor properly.
     */
    shutdown() {
        this.service.shutdown();
    }
}

export const Executor = new ThreadExecutor();
