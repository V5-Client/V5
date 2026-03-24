import { OverlayManager } from '../../gui/OverlayUtils';
import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { TimeUtils, Timer } from '../../utils/TimeUtils';
import { Utils } from '../../utils/Utils';
import { Webhook } from '../../utils/Webhooks';

const STATE = {
    IDLE: 'Idle',
    RUNNING: 'Running',
    RESTING: 'Resting',
    RETURNING: 'Returning',
};

class MacroScheduler extends ModuleBase {
    constructor() {
        super({
            name: 'Scheduler',
            subcategory: 'Core',
            description: 'Automates macro sessions, breaks, and relogging.',
            showEnabledToggle: false,
            hideInModules: true,
        });

        this.macroTimeMin = 80;
        this.macroTimeMax = 140;
        this.breakTimeMin = 50;
        this.breakTimeMax = 100;

        this.configPath = 'scheduler_data.json';
        this.state = STATE.IDLE;
        this.trackedMacros = [];
        this.timerEnd = 0;
        this.breakDurationMs = 0;
        this.returnStep = 0;
        this.overlayShown = false;

        this.worldUnloadTimer = new Timer();

        const sectionName = 'Scheduler';
        this.addDirectToggle('Enable Scheduler', (v) => this.toggle(!!v), 'Toggles the scheduler.', true, sectionName);
        this.addDirectRangeSlider(
            'Macro Duration (m)',
            10,
            240,
            { low: this.macroTimeMin, high: this.macroTimeMax },
            (v) => {
                this.macroTimeMin = v.low;
                this.macroTimeMax = v.high;
            },
            'Minimum session duration.',
            sectionName
        );
        this.addDirectRangeSlider(
            'Break Duration (m)',
            10,
            180,
            { low: this.breakTimeMin, high: this.breakTimeMax },
            (v) => {
                this.breakTimeMin = v.low;
                this.breakTimeMax = v.high;
            },
            'Minimum break duration.',
            sectionName
        );

        this.createSchedulerOverlay([
            {
                title: 'Scheduler',
                data: {
                    Status: () => this.state,
                    'Time Left': () => this.formatTimeLeft(),
                    Active: () => this.getActiveMacroDisplay(),
                },
            },
        ]);

        this.loadState();
        register('gameUnload', () => this.saveState());
        this.on('step', () => this.tick()).setFps(20);
    }

    loadState() {
        const data = Utils.getConfigFile(this.configPath);
        if (data) {
            const validState = Object.values(STATE).includes(data.state) ? data.state : STATE.IDLE;
            this.state = validState;
            this.trackedMacros = Array.isArray(data.trackedMacros) ? data.trackedMacros.filter((v) => typeof v === 'string') : [];
            this.timerEnd = Number.isFinite(data.timerEnd) ? data.timerEnd : 0;
            this.breakDurationMs = Number.isFinite(data.breakDurationMs) ? data.breakDurationMs : 0;
            this.returnStep = Number.isFinite(data.returnStep) ? Math.max(0, Math.min(3, data.returnStep)) : 0;
        }
    }

    saveState() {
        Utils.writeConfigFile(this.configPath, {
            state: this.state,
            trackedMacros: this.trackedMacros,
            timerEnd: this.timerEnd,
            breakDurationMs: this.breakDurationMs,
            returnStep: this.returnStep,
        });
    }

    onEnable() {
        const now = Date.now();
        if (this.state !== STATE.IDLE && this.getSchedulableMacros().length === 0) {
            this.state = STATE.IDLE;
            this.timerEnd = 0;
            this.returnStep = 0;
        }

        if (this.state === STATE.RUNNING && now >= this.timerEnd) {
            this.endSession();
        } else if (this.state === STATE.RESTING && now >= this.timerEnd) {
            this.beginReturn();
        }
        this.saveState();
        if (this.state === STATE.IDLE) {
            OverlayManager.resetTime(this.oid);
            this.overlayShown = false;
        } else {
            this.updateOverlay();
        }
        Chat.messageScheduler('&aStarted.');
    }

    onDisable() {
        this.saveState();
        OverlayManager.resetTime(this.oid);
        this.overlayShown = false;
        Chat.messageScheduler('&cStopped.');
    }

    tick() {
        if (!this.enabled) return;
        this.updateOverlay();

        switch (this.state) {
            case STATE.IDLE:
                this.handleIdle();
                break;
            case STATE.RUNNING:
                this.handleRunning();
                break;
            case STATE.RESTING:
                this.handleResting();
                break;
            case STATE.RETURNING:
                this.handleReturning();
                break;
        }
    }

    updateOverlay() {
        const shouldShow = this.state !== STATE.IDLE;
        if (shouldShow && !this.overlayShown) {
            OverlayManager.startTime(this.oid, true);
            this.overlayShown = true;
        } else if (!shouldShow && this.overlayShown) {
            OverlayManager.resetTime(this.oid);
            this.overlayShown = false;
        }
    }

    handleIdle() {
        const enabled = this.getSchedulableMacros();

        if (enabled.length > 0) {
            this.trackedMacros = [...enabled];
            this.beginSession();
        }
    }

    handleRunning() {
        const now = Date.now();
        const enabled = this.getSchedulableMacros();

        if (enabled.length === 0) {
            this.state = STATE.IDLE;
            this.timerEnd = 0;
            this.trackedMacros = [];
            this.saveState();
            this.updateOverlay();
            return;
        }

        const trackedSet = new Set(this.trackedMacros);
        if (enabled.length !== this.trackedMacros.length || enabled.some((m) => !trackedSet.has(m))) {
            this.trackedMacros = [...enabled];
            this.saveState();
        }

        if (now >= this.timerEnd) {
            this.endSession();
            return;
        }

        if (!World.isLoaded()) {
            if (!this.worldUnloadTimer.running) this.worldUnloadTimer.setDelayRandom(7000, 13000);
        } else {
            this.worldUnloadTimer.reset();
        }

        if (this.worldUnloadTimer.hasReachedDelay()) {
            this.worldUnloadTimer.reset();
            Chat.messageScheduler('&eConnecting to Hypixel...');
            Client.connect('mc.hypixel.net');
        }
    }

    handleResting() {
        if (Date.now() >= this.timerEnd) {
            if (this.trackedMacros.length === 0) {
                this.state = STATE.IDLE;
                this.timerEnd = 0;
                this.saveState();
                this.updateOverlay();
                return;
            }
            this.beginReturn();
        }
    }

    handleReturning() {
        const now = Date.now();

        if (this.returnStep === 0) {
            if (World.isLoaded()) {
                this.returnStep = 2;
                this.timerEnd = now + 5000;
                this.saveState();
                return;
            }
            Chat.messageScheduler('&eConnecting to Hypixel...');
            Client.connect('mc.hypixel.net');
            this.returnStep = 1;
            this.timerEnd = now + 12000;
            this.saveState();
            return;
        }

        if (this.returnStep === 1) {
            if (!World.isLoaded()) {
                if (now < this.timerEnd) return;
                Chat.messageScheduler('&eRetrying connection...');
                Client.connect('mc.hypixel.net');
                this.timerEnd = now + 12000;
                this.saveState();
                return;
            }
            this.returnStep = 2;
            this.timerEnd = now + 5000;
            this.saveState();
            return;
        }

        if (this.returnStep === 2) {
            if (now < this.timerEnd) return;
            Chat.messageScheduler('&eJoining Skyblock...');
            ChatLib.command('play skyblock');
            this.returnStep = 3;
            this.timerEnd = Date.now() + 3000;
            this.saveState();
            return;
        }

        if (this.returnStep === 3) {
            if (now < this.timerEnd) return;
            Chat.messageScheduler('&aStarting macros.');
            this.startTrackedMacros();
            this.sendSchedulerConnectEmbed();
            this.beginSession();
        }
    }

    beginSession() {
        this.state = STATE.RUNNING;
        const duration = this.randomDuration(this.macroTimeMin, this.macroTimeMax);
        this.timerEnd = Date.now() + duration;
        this.returnStep = 0;
        this.saveState();
        this.updateOverlay();
    }

    endSession() {
        this.breakDurationMs = this.randomDuration(this.breakTimeMin, this.breakTimeMax);
        const breakTime = TimeUtils.formatDurationMs(this.breakDurationMs);
        const cleanBreakTime = breakTime.includes(' ') ? breakTime.replace(/ (?=[^ ]+$)/, ' and ') : breakTime;

        this.stopTrackedMacros();
        this.sendSchedulerDisconnectEmbed(cleanBreakTime);

        const reason = `Scheduler: Resting for ${cleanBreakTime}`;
        this.disconnect(reason);

        this.state = STATE.RESTING;
        this.timerEnd = Date.now() + this.breakDurationMs;
        this.saveState();
        this.updateOverlay();
    }

    beginReturn() {
        this.state = STATE.RETURNING;
        this.returnStep = 0;
        this.saveState();
        this.updateOverlay();
    }

    cancelScheduledMacro(macroName) {
        if (!macroName || !this.enabled) return false;
        if (this.state !== STATE.RESTING && this.state !== STATE.RETURNING) return false;

        const index = this.trackedMacros.indexOf(macroName);
        if (index === -1) return false;

        this.trackedMacros.splice(index, 1);

        const duration = this.getMacroDuration(macroName);
        Webhook.sendScreenshot(`Disabled ${macroName}`, duration);

        if (this.trackedMacros.length === 0) {
            this.state = STATE.IDLE;
            this.timerEnd = 0;
            this.breakDurationMs = 0;
            this.returnStep = 0;
            Chat.messageScheduler(`&e${macroName} disabled.`);
        } else {
            Chat.messageScheduler(`&e${macroName} disabled, ${this.trackedMacros.length} others remaining.`);
        }

        this.saveState();
        this.updateOverlay();
        return true;
    }

    startTrackedMacros() {
        this.trackedMacros.forEach((name) => {
            const module = MacroState.getModule(name);
            if (module && module.isMacro && !module.enabled) module.toggle(true, false, 'scheduler');
        });
    }

    stopTrackedMacros() {
        this.trackedMacros.forEach((name) => {
            const module = MacroState.getModule(name);
            if (module && module.isMacro) module.toggle(false, true, 'scheduler');
        });
    }

    sendSchedulerDisconnectEmbed(cleanBreakTime) {
        const lines = [];

        this.trackedMacros.forEach((name) => {
            const meta = MacroState.getLastDisableMeta(name);
            if (!meta || meta.context !== 'scheduler') return;

            const macroLines = [];
            const runtime = this.getMacroDuration(name);
            if (runtime) macroLines.push(`Runtime: ${runtime}`);

            const stats = this.getMacroOverlayStats(name);
            if (stats.length) macroLines.push(...stats.slice(0, 4));

            lines.push('**' + name + '**' + (macroLines.length ? '\n' + macroLines.join('\n') : ''));
        });

        const description = [`Break Time: ${cleanBreakTime}`, lines.length ? lines.join('\n\n') : 'No macro stats available.'].join('\n\n');
        this.sendSchedulerEmbed('Scheduler Disconnected', description, 0xe67e22);
    }

    sendSchedulerConnectEmbed() {
        const macroList = this.trackedMacros.length ? this.trackedMacros.join(', ') : 'None';
        this.sendSchedulerEmbed('Scheduler Connected', `Resuming macros: ${macroList}`, 0x2ecc71);
    }

    sendSchedulerEmbed(title, description, color) {
        Webhook.sendEmbed(
            [
                {
                    title,
                    description,
                    color,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'V5 Scheduler' },
                },
            ],
            false
        );
    }

    getMacroDuration(macroName) {
        const saved = OverlayManager.savedSessions && OverlayManager.savedSessions[macroName];
        if (saved && typeof saved.elapsedMs === 'number') {
            return TimeUtils.formatDurationMs(saved.elapsedMs);
        }

        const startTime = OverlayManager.startTimes && OverlayManager.startTimes[macroName];
        if (startTime) return OverlayManager.formatUptime(startTime);
        return '';
    }

    getMacroOverlayStats(macroName) {
        const module = MacroState.getModule(macroName);
        if (!module) return [];

        const overlayName = module.oid || macroName;
        const overlay = Array.isArray(OverlayManager.ids) ? OverlayManager.ids.find((id) => id && id.name === overlayName) : null;
        if (!overlay || !Array.isArray(overlay.sections)) return [];

        const lines = [];
        overlay.sections.forEach((section) => {
            const data = section && section.data ? section.data : null;
            if (!data || typeof data !== 'object') return;

            Object.entries(data).forEach(([key, value]) => {
                try {
                    const resolved = typeof value === 'function' ? value() : value;
                    if (resolved === undefined || resolved === null || String(resolved).trim() === '') return;
                    lines.push(`${key}: ${resolved}`);
                } catch (e) {}
            });
        });

        return lines;
    }

    getSchedulableMacros() {
        return MacroState.getEnabledMacros().filter((name) => {
            const module = MacroState.getModule(name);
            return module && module.isMacro && !module.isParentManaged;
        });
    }

    disconnect(reason) {
        try {
            const mc = Client.getMinecraft();
            if (mc.getNetworkHandler()) {
                const text = net.minecraft.text.Text.of(reason);
                mc.getNetworkHandler().getConnection().disconnect(text);
            }
        } catch (e) {
            console.error('Scheduler disconnect error:', e);
        }
    }

    randomDuration(minMinutes, maxMinutes) {
        const min = Math.min(minMinutes, maxMinutes);
        const max = Math.max(minMinutes, maxMinutes);
        return (min + Math.random() * (max - min)) * 60000;
    }

    formatTimeLeft() {
        if (this.state === STATE.IDLE) return 'Waiting';

        const remaining = Math.max(0, this.timerEnd - Date.now());
        const timeStr = TimeUtils.formatDurationMs(remaining);

        if (this.state === STATE.RETURNING) {
            return `Returning (${timeStr})`;
        }

        return timeStr;
    }

    getActiveMacroDisplay() {
        if (this.trackedMacros.length === 0) return 'None';
        if (this.trackedMacros.length === 1) return this.trackedMacros[0];
        return `${this.trackedMacros[0]} +${this.trackedMacros.length - 1}`;
    }
}

new MacroScheduler();
