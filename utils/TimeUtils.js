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
