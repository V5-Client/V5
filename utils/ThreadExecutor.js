import { AtomicInteger, Executors } from './Constants';

const threadNumber = new AtomicInteger(1);
const service = Executors.newCachedThreadPool((runnable) => {
    const thread = new java.lang.Thread(runnable);
    thread.setDaemon(true);
    thread.setName(`V5-Executor-${threadNumber.getAndIncrement()}`);
    return thread;
});

export function executeAsync(task) {
    if (service.isShutdown() || typeof task !== 'function') return;
    service.execute(() => {
        try {
            task();
        } catch (error) {
            console.error('[V5 Thread Error]:');
            console.error(error);
        }
    });
}

const shutdownExecutor = () => service.shutdownNow();

register('gameUnload', shutdownExecutor);
