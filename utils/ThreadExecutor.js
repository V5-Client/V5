const service = Java.type('com.chattriggers.ctjs.api.V5Executor');

export function executeAsync(task) {
    if (typeof task !== 'function') return false;
    const generation = service.generation();
    return service.tryExecute(() => {
        if (!service.isCurrent(generation)) return;
        try {
            task(generation);
        } catch (error) {
            console.error('[V5 Thread Error]:');
            console.error(error);
        }
    });
}

export function scheduleClient(task, delay = 0, generation = service.generation()) {
    if (typeof task !== 'function') return;
    Client.scheduleTask(delay, () => {
        if (service.isCurrent(generation)) task();
    });
}

export const getExecutorGeneration = () => service.generation();
export const isExecutorGenerationCurrent = (generation) => service.isCurrent(generation);

export const Executor = { execute: executeAsync };
