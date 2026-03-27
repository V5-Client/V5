let currentTick = 0;
let queuedTasks = [];

register('tick', () => {
    currentTick++;
    if (!queuedTasks.length) return;

    const remaining = [];
    const due = [];

    for (let i = 0; i < queuedTasks.length; i++) {
        const entry = queuedTasks[i];
        if (!entry || typeof entry.task !== 'function') continue;
        if (entry.runAtTick <= currentTick) due.push(entry.task);
        else remaining.push(entry);
    }

    queuedTasks = remaining;

    for (let i = 0; i < due.length; i++) {
        try {
            const callback = due[i];
            if (typeof callback !== 'function') continue;
            callback();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }
});

export function ScheduleTask(delayOrTask, maybeTask) {
    const hasExplicitDelay = typeof delayOrTask !== 'function';
    const delayRaw = hasExplicitDelay ? Number(delayOrTask) || 0 : 0;
    const task = hasExplicitDelay ? maybeTask : delayOrTask;

    if (typeof task !== 'function') return;

    const delayTicks = Math.max(1, Math.floor(delayRaw));
    queuedTasks.push({
        runAtTick: currentTick + delayTicks,
        task,
    });
}
