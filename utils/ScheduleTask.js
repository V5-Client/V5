import { finiteNumber } from './NumberUtils';

let currentTick = 0;
let queuedTasks = [];

register('tick', () => {
    currentTick++;
    if (!queuedTasks.length) return;

    const remaining = [];
    const due = [];

    for (const entry of queuedTasks) {
        if (!entry || typeof entry.task !== 'function') continue;
        if (entry.runAtTick <= currentTick) due.push(entry.task);
        else remaining.push(entry);
    }

    queuedTasks = remaining;

    for (const callback of due) {
        try {
            callback();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }
});

export function ScheduleTask(delayOrTask, maybeTask) {
    const hasExplicitDelay = typeof delayOrTask !== 'function';
    const delayRaw = hasExplicitDelay ? finiteNumber(delayOrTask) : 0;
    const task = hasExplicitDelay ? maybeTask : delayOrTask;

    if (typeof task !== 'function') return;

    const delayTicks = Math.max(1, Math.floor(delayRaw));
    queuedTasks.push({
        runAtTick: currentTick + delayTicks,
        task,
    });
}
