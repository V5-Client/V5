export class Time {
    constructor() {
        this.epoch = Date.now();
        this.pausedAt = 0;
        this.waiting = false;
        this.delayTarget = 0;
    }

    hasReached(duration) {
        if (this.waiting) {
            const now = Date.now();
            const elapsed = now - this.epoch;
            const effectiveElapsed = this.pausedAt > 0 ? elapsed - (now - this.pausedAt) : elapsed;
            return effectiveElapsed >= duration;
        }
        return Date.now() - this.epoch >= duration;
    }

    setHasReached() {
        this.epoch = 0;
    }

    reset() {
        this.epoch = Date.now();
        this.pausedAt = 0;
        this.waiting = false;
    }

    getTime() {
        return this.epoch;
    }

    setTime(newTime) {
        this.epoch = newTime;
    }

    getTimePassed() {
        const now = Date.now();
        if (this.pausedAt > 0) {
            return this.pausedAt - this.epoch;
        }
        return now - this.epoch;
    }

    pause() {
        if (this.pausedAt === 0) {
            this.pausedAt = Date.now();
        }
    }

    unpause() {
        if (this.pausedAt > 0) {
            const pauseDuration = Date.now() - this.pausedAt;
            this.epoch += pauseDuration;
            this.pausedAt = 0;
        }
    }

    setRandomReached(min, max) {
        this.delayTarget = Math.floor(Math.random() * (max - min + 1)) + min;
        this.waiting = true;
    }

    reachedRandom() {
        return this.hasReached(this.delayTarget);
    }
}

export const TimeUtils = {
    /**
     * Formats a duration in ms into the good looking string
     * Examples: 0.00s, 12.34s, 1m 2s, 3h 4m 5s, 2d 3h 4m 5s
     */
    formatDurationMs: (durationMs) => {
        if (!durationMs || durationMs <= 0) return '0.00s';

        const totalSeconds = Math.floor(durationMs / 1000);

        const s = totalSeconds % 60;
        const m = Math.floor(totalSeconds / 60) % 60;
        const h = Math.floor(totalSeconds / 3600) % 24;
        const d = Math.floor(totalSeconds / 86400);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);

        if (totalSeconds < 60) {
            const cs = Math.floor((durationMs % 1000) / 10);
            const csStr = String(cs).padStart(2, '0');
            parts.push(`${s}.${csStr}s`);
        } else {
            parts.push(`${s}s`);
        }

        return parts.join(' ');
    },

    /**
     * Time since start timestamp
     */
    formatUptime: (startTimeMs) => {
        if (!startTimeMs) return '0.00s';
        return TimeUtils.formatDurationMs(Date.now() - startTimeMs);
    },
};
