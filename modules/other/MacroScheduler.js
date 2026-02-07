import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { OverlayManager } from '../../gui/OverlayUtils';

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
        this.on('tick', () => this.tick());
    }

    loadState() {
        const data = Utils.getConfigFile(this.configPath);
        if (data) {
            this.state = data.state || STATE.IDLE;
            this.trackedMacros = data.trackedMacros || [];
            this.timerEnd = data.timerEnd || 0;
            this.breakDurationMs = data.breakDurationMs || 0;
            this.returnStep = data.returnStep || 0;
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
        const enabled = MacroState.getEnabledMacros().filter((name) => {
            const module = MacroState.getModule(name);
            return module && !module.isParentManaged;
        });

        if (enabled.length > 0) {
            this.trackedMacros = [...enabled];
            this.beginSession();
        }
    }

    handleRunning() {
        const now = Date.now();
        const enabled = MacroState.getEnabledMacros().filter((name) => {
            const module = MacroState.getModule(name);
            return module && !module.isParentManaged;
        });

        if (enabled.length === 0) {
            this.state = STATE.IDLE;
            this.timerEnd = 0;
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
        }
    }

    handleResting() {
        if (Date.now() >= this.timerEnd) {
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
            this.saveState();
            return;
        }

        if (this.returnStep === 1) {
            if (!World.isLoaded()) return;
            this.returnStep = 2;
            this.timerEnd = Date.now() + 5000;
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
        const breakMinutes = Math.round(this.breakDurationMs / 60000);

        this.stopTrackedMacros();

        const reason = `Scheduler: Resting for ~${breakMinutes} minutes`;
        Chat.messageScheduler(`&eSession ended. Resting for ~${breakMinutes} minutes.`);
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

    startTrackedMacros() {
        this.trackedMacros.forEach((name) => {
            const module = MacroState.getModule(name);
            if (module) module.toggle(true, false);
        });
    }

    stopTrackedMacros() {
        this.trackedMacros.forEach((name) => {
            const module = MacroState.getModule(name);
            if (module) module.toggle(false, true);
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
        const totalSeconds = Math.ceil(remaining / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;

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
