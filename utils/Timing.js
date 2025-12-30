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
