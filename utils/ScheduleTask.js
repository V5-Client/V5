export function ScheduleTask(delayOrTask, maybeTask) {
    const hasExplicitDelay = typeof delayOrTask !== 'function';
    const delay = hasExplicitDelay ? Number(delayOrTask) || 0 : 0;
    const task = hasExplicitDelay ? maybeTask : delayOrTask;

    if (typeof task !== 'function') return;

    const safeTask = () => {
        try {
            task();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    };

    if (hasExplicitDelay) {
        Client.scheduleTask(delay, safeTask);
        return;
    }

    Client.scheduleTask(safeTask);
}
