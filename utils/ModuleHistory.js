import { Utils } from './Utils';

const HISTORY_FILE = 'module_history.json';
const SAMPLE_INTERVAL_MS = 60 * 1000;

class ModuleHistoryTracker {
    constructor() {
        this.history = this.loadHistory();
        this.activeSessions = {};
        this.recoverStaleSessions();

        register('step', () => this.sampleDueSessions()).setFps(1);
        register('gameUnload', () => this.endAllSessions('game_unload'));
    }

    loadHistory() {
        const data = Utils.getConfigFile(HISTORY_FILE);
        return data.sessions ? data : { version: 1, sessions: [] };
    }

    recoverStaleSessions() {
        let changed = false;

        this.history.sessions.forEach((session) => {
            if (!session || !session.active) return;

            session.minuteData = session.minuteData || [];
            const lastPoint = session.minuteData[session.minuteData.length - 1];
            const endedAtMs = lastPoint?.timestampMs || session.enabledAtMs;

            session.active = false;
            session.disabledAtMs = endedAtMs;
            session.disabledAt = this.toIso(endedAtMs);
            session.durationMs = Math.max(0, endedAtMs - (session.enabledAtMs || endedAtMs));
            session.endReason = 'startup_recovery';
            session.minuteData.push({
                type: 'end',
                minute: Math.floor(endedAtMs / SAMPLE_INTERVAL_MS),
                timestampMs: endedAtMs,
                timestamp: session.disabledAt,
                elapsedMs: session.durationMs,
                overlayData: session.overlayData,
            });
            changed = true;
        });

        if (changed) this.saveHistory();
    }

    startSession(moduleName, options = {}) {
        if (!moduleName || !options.isMacro) return;

        if (this.activeSessions[moduleName]) {
            this.endSession(moduleName, 'restart');
        }

        const now = Date.now();
        const session = {
            id: `${moduleName}-${now}`,
            module: moduleName,
            overlayId: options.overlayId || null,
            category: options.category || null,
            isMacro: options.isMacro === true,
            parentManaged: options.parentManaged === true,
            toggleContext: options.toggleContext || 'user',
            enabledAtMs: now,
            enabledAt: this.toIso(now),
            disabledAtMs: null,
            disabledAt: null,
            durationMs: 0,
            active: true,
            overlayData: null,
            minuteData: [],
        };

        this.history.sessions.push(session);
        this.activeSessions[moduleName] = {
            session,
            getOverlayData: options.getOverlayData,
            nextSampleAt: now,
        };

        this.recordSample(moduleName, now, 'start');
        this.activeSessions[moduleName].nextSampleAt = now + SAMPLE_INTERVAL_MS;
        this.saveHistory();
    }

    sampleDueSessions() {
        const now = Date.now();
        let changed = false;

        Object.keys(this.activeSessions).forEach((moduleName) => {
            const active = this.activeSessions[moduleName];
            if (!active || now < active.nextSampleAt) return;

            this.recordSample(moduleName, now, 'minute');
            active.nextSampleAt = Math.floor(now / SAMPLE_INTERVAL_MS) * SAMPLE_INTERVAL_MS + SAMPLE_INTERVAL_MS;
            changed = true;
        });

        if (changed) this.saveHistory();
    }

    endSession(moduleName, reason = 'disabled') {
        const active = this.activeSessions[moduleName];
        if (!active) return;

        const now = Date.now();
        this.recordSample(moduleName, now, 'end');

        const session = active.session;
        session.active = false;
        session.disabledAtMs = now;
        session.disabledAt = this.toIso(now);
        session.durationMs = Math.max(0, now - session.enabledAtMs);
        session.endReason = reason;

        delete this.activeSessions[moduleName];
        this.saveHistory();
    }

    endAllSessions(reason = 'disabled') {
        Object.keys(this.activeSessions).forEach((moduleName) => this.endSession(moduleName, reason));
    }

    recordSample(moduleName, timestampMs = Date.now(), type = 'minute') {
        const active = this.activeSessions[moduleName];
        if (!active) return;

        const session = active.session;
        const overlayData = active.getOverlayData ? active.getOverlayData() : null;
        session.overlayData = overlayData;
        session.durationMs = Math.max(0, timestampMs - session.enabledAtMs);
        session.minuteData.push({
            type,
            minute: Math.floor(timestampMs / SAMPLE_INTERVAL_MS),
            timestampMs,
            timestamp: this.toIso(timestampMs),
            elapsedMs: session.durationMs,
            overlayData,
        });
    }

    saveHistory() {
        Utils.writeConfigFile(HISTORY_FILE, this.history);
    }

    toIso(timestampMs) {
        return new Date(timestampMs).toISOString();
    }
}

export const ModuleHistory = new ModuleHistoryTracker();
