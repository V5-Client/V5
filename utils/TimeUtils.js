export class Timer {
    constructor() {
        this.epoch = Date.now();
        this.delayTarget = 0;
        this.running = false;
    }

    setDelay(delay) {
        this.epoch = Date.now();
        this.delayTarget = delay;
        this.running = true;
    }

    setDelayRandom(min, max) {
        this.setDelay(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    hasReachedDelay() {
        return this.running && this.hasPassed(this.delayTarget);
    }

    hasPassed(duration) {
        return Date.now() - this.epoch >= duration;
    }

    reset() {
        this.epoch = Date.now();
        this.running = false;
    }
}

export function formatDurationMs(durationMs) {
    if (!durationMs || durationMs <= 0) return '0.00s';

    const totalSeconds = Math.floor(durationMs / 1000);

    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const days = Math.floor(totalSeconds / 86400);

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);

    if (totalSeconds < 60) {
        parts.push(`${seconds}.${String(Math.floor((durationMs % 1000) / 10)).padStart(2, '0')}s`);
    } else {
        parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}

export const formatUptime = (startTimeMs) => (startTimeMs ? formatDurationMs(Date.now() - startTimeMs) : '0.00s');
