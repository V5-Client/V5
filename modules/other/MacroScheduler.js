import { OverlayManager } from '../../gui/OverlayUtils';
import { getEnabledMacros, getLastDisableMeta, getModule, getModuleDuration } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { ClientboundDisconnectPacket, ClientboundLoginDisconnectPacket } from '../../utils/Packets';
import { formatDurationMs } from '../../utils/TimeUtils';
import { area, getConfigFile, writeConfigFile } from '../../utils/Utils';
import { closeInventory } from '../../utils/player/Inventory';
import { Webhook } from '../../utils/Webhooks';

const STATE = {
    IDLE: 'Idle',
    RUNNING: 'Running',
    RESTING: 'Resting',
    RETURNING: 'Returning',
    PAUSED: 'Paused',
};

const RECOVERY_STATE = {
    WAITING: 'Waiting to reconnect',
    CONNECTING: 'Connecting to Hypixel',
    LEAVING_LIMBO: 'Leaving Limbo',
    SETTLING: 'Waiting for lobby',
    JOINING_SKYBLOCK: 'Joining SkyBlock',
};

const HYPIXEL_ADDRESS = 'mc.hypixel.net';
const RECONNECT_DELAY = 5_000;
const CONNECT_TIMEOUT = 15_000;
const LOBBY_SETTLE_TIME = 4_000;
const LOBBY_TIMEOUT = 20_000;
const SKYBLOCK_JOIN_TIMEOUT = 30_000;
const OUTSIDE_SKYBLOCK_TIMEOUT = 8_000;
const LIMBO_PATTERN =
    /you were spawned in limbo|you (?:have been sent|are being sent|were sent) to limbo|you are (?:currently )?in limbo|sending you to limbo|you are afk\. move around to return from afk|a kick occurred in your connection/i;
const UNSAFE_RECONNECT_PATTERN = /\bbanned\b|cheating|boosting|security alert|logged in from another location/i;
const clean = (value) =>
    ChatLib.removeFormatting(String(value ?? ''))
        .trim()
        .replace(/^[^a-z0-9]+/i, '')
        .toLowerCase();

class MacroScheduler extends ModuleBase {
    constructor() {
        super({
            name: 'Scheduler',
            subcategory: 'Core',
            description: 'Automates macro sessions, breaks, and relogging.',
            theme: '#7c8cff',
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
        this.pausedRemainingMs = 0;
        this.autoReconnect = true;
        this.recoveryState = null;
        this.recoveryAt = 0;
        this.recoveryDeadline = 0;
        this.recoveryMacros = [];
        this.recoverySessionRemainingMs = 0;
        this.recoverySawWorldUnload = false;
        this.lobbyConfirmed = false;
        this.outsideSkyblockSince = 0;

        const sectionName = 'Scheduler';
        this.addDirectToggle('Enable Scheduler', (v) => this.toggle(!!v), 'Toggles the scheduler.', true, sectionName);
        this.addDirectToggle(
            'Auto Reconnect',
            (value) => (this.autoReconnect = !!value),
            'Recovers tracked macros from Limbo or disconnects, returns to SkyBlock, and resumes them.',
            true,
            sectionName
        );
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
                    Status: () => this.recoveryState || this.state,
                    'Time Left': () => this.formatTimeLeft(),
                    Active: () => this.getActiveMacroDisplay(),
                },
            },
        ]);

        this.loadState();
        register('gameUnload', () => this.saveState());
        this.on('chat', (event) => this.onChat(event));
        this.on('worldLoad', () => this.onWorldLoad());
        this.on('worldUnload', () => this.onWorldUnload());
        this.on('packetReceived', (packet) => this.onDisconnectPacket(packet)).setFilteredClasses([
            ClientboundLoginDisconnectPacket,
            ClientboundDisconnectPacket,
        ]);
        this.on('step', () => this.tick()).setFps(20);
    }

    loadState() {
        const data = getConfigFile(this.configPath);
        if (!data) return;

        const savedState = Object.values(STATE).includes(data.state) ? data.state : STATE.IDLE;
        this.state = savedState === STATE.PAUSED ? STATE.IDLE : savedState;
        this.trackedMacros = Array.isArray(data.trackedMacros) ? data.trackedMacros.filter((v) => typeof v === 'string') : [];
        this.timerEnd = Number.isFinite(data.timerEnd) ? data.timerEnd : 0;
        this.breakDurationMs = Number.isFinite(data.breakDurationMs) ? data.breakDurationMs : 0;
        this.returnStep = Number.isFinite(data.returnStep) ? Math.max(0, Math.min(3, data.returnStep)) : 0;
    }

    saveState() {
        writeConfigFile(this.configPath, {
            state: this.state,
            trackedMacros: this.trackedMacros,
            timerEnd: this.timerEnd,
            breakDurationMs: this.breakDurationMs,
            returnStep: this.returnStep,
        });
    }

    onEnable() {
        const now = Date.now();
        if (this.state !== STATE.IDLE && this.trackedMacros.length === 0) {
            this.state = STATE.IDLE;
            this.timerEnd = 0;
            this.returnStep = 0;
            this.pausedRemainingMs = 0;
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
        this.message('&aStarted.');
    }

    onDisable() {
        this.resetRecovery();
        this.saveState();
        OverlayManager.resetTime(this.oid);
        this.overlayShown = false;
        this.message('&cStopped.');
    }

    tick() {
        if (!this.enabled) return;
        this.updateOverlay();
        if (this.recoveryState) return this.tickRecovery();

        switch (this.state) {
            case STATE.IDLE:
                this.handleIdle();
                break;
            case STATE.RUNNING:
                this.handleRunning();
                break;
            case STATE.PAUSED:
                this.handlePaused();
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
        const shouldShow = this.state !== STATE.IDLE && this.state !== STATE.PAUSED;
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
        if (this.autoReconnect) {
            if (!World.isLoaded()) return this.beginReconnect('Lost connection to Hypixel.', false);
            if (this.isInSkyblock()) {
                this.outsideSkyblockSince = 0;
            } else if (!this.outsideSkyblockSince) {
                this.outsideSkyblockSince = now;
            } else if (now - this.outsideSkyblockSince >= OUTSIDE_SKYBLOCK_TIMEOUT) {
                return this.beginLimboRecovery('Detected that the session is no longer in SkyBlock.');
            }
        }

        const enabled = this.getSchedulableMacros();
        if (enabled.length === 0) {
            this.pauseSession();
            return;
        }

        const trackedSet = new Set(this.trackedMacros);
        if (enabled.length !== this.trackedMacros.length || enabled.some((m) => !trackedSet.has(m))) {
            this.trackedMacros = [...enabled];
            this.saveState();
        }

        if (now >= this.timerEnd) this.endSession();
    }

    onChat(event) {
        if (!this.autoReconnect || this.state !== STATE.RUNNING) return;
        const message = event?.message?.getUnformattedText?.() ?? event?.message?.getString?.() ?? '';
        if (LIMBO_PATTERN.test(message)) this.beginLimboRecovery('Detected Limbo.');
    }

    onWorldLoad() {
        if (!this.recoveryState) return;
        if (this.recoveryState !== RECOVERY_STATE.CONNECTING && this.recoveryState !== RECOVERY_STATE.LEAVING_LIMBO) return;
        if (this.recoveryState === RECOVERY_STATE.LEAVING_LIMBO && !this.recoverySawWorldUnload) return;

        this.lobbyConfirmed = true;
        this.recoveryState = RECOVERY_STATE.SETTLING;
        this.recoveryAt = Date.now() + LOBBY_SETTLE_TIME;
        this.recoveryDeadline = Date.now() + LOBBY_TIMEOUT;
    }

    onWorldUnload() {
        if (this.recoveryState) {
            this.recoverySawWorldUnload = true;
            return;
        }
        if (!this.autoReconnect || this.state !== STATE.RUNNING) return;
        this.beginReconnect('Macro world closed; waiting for a possible Hypixel transfer.', false, CONNECT_TIMEOUT);
        this.recoverySawWorldUnload = true;
    }

    onDisconnectPacket(packet) {
        if (!this.autoReconnect || this.state !== STATE.RUNNING) return;
        const reason = packet?.reason?.();
        const text = reason?.getString?.() || reason?.toString?.() || 'Disconnected from Hypixel.';
        if (UNSAFE_RECONNECT_PATTERN.test(text)) {
            if (this.prepareRecovery()) this.abortRecovery(`Not reconnecting after disconnect: ${text}`);
            return;
        }
        this.beginReconnect(`Disconnected: ${text}`, false);
    }

    prepareRecovery() {
        if (this.recoveryState) return true;
        if (!this.enabled || !this.autoReconnect || this.state !== STATE.RUNNING) return false;

        const enabled = this.getSchedulableMacros();
        this.recoveryMacros = [...new Set([...this.trackedMacros, ...enabled])].filter((name) => {
            const module = getModule(name);
            return module && module.isMacro && !module.isParentManaged;
        });
        if (!this.recoveryMacros.length) return false;

        this.recoverySessionRemainingMs = Math.max(0, this.timerEnd - Date.now());
        Client.unpressKeys();
        closeInventory();
        this.recoveryMacros.forEach((name) => {
            const module = getModule(name);
            if (module?.enabled) module.toggle(false, true, 'scheduler-reconnect');
        });
        return true;
    }

    beginReconnect(reason, disconnectLoadedWorld, delay = RECONNECT_DELAY) {
        if (!this.prepareRecovery()) return;
        this.recoveryState = RECOVERY_STATE.WAITING;
        this.recoveryAt = Date.now() + delay;
        this.recoveryDeadline = 0;
        this.lobbyConfirmed = false;
        this.outsideSkyblockSince = 0;
        this.message(`&e${reason} Checking again in ${Math.ceil(delay / 1_000)} seconds...`);
        if (disconnectLoadedWorld && World.isLoaded()) this.disconnect('Scheduler: reconnecting to Hypixel');
    }

    beginLimboRecovery(reason) {
        if (this.recoveryState === RECOVERY_STATE.LEAVING_LIMBO || !this.prepareRecovery()) return;
        this.recoverySawWorldUnload = false;
        this.lobbyConfirmed = false;
        this.outsideSkyblockSince = 0;
        this.recoveryState = RECOVERY_STATE.LEAVING_LIMBO;
        this.recoveryAt = Date.now() + LOBBY_SETTLE_TIME;
        this.recoveryDeadline = Date.now() + LOBBY_TIMEOUT;
        this.message(`&e${reason} Running /lobby...`);
        ChatLib.command('lobby');
    }

    tickRecovery() {
        if (!this.autoReconnect) return this.abortRecovery('Auto Reconnect was disabled while recovering.');
        const now = Date.now();

        switch (this.recoveryState) {
            case RECOVERY_STATE.WAITING:
                if (World.isLoaded()) {
                    if (this.isInSkyblock()) return this.completeRecovery();
                    if (this.joinSkyblockFromLobby()) return;
                    return this.beginLimboRecovery('Still connected to Hypixel outside SkyBlock.');
                }
                if (now < this.recoveryAt) return;
                this.connectToHypixel();
                return;
            case RECOVERY_STATE.CONNECTING:
                if (World.isLoaded()) {
                    this.lobbyConfirmed = true;
                    this.recoveryState = RECOVERY_STATE.SETTLING;
                    this.recoveryAt = now + LOBBY_SETTLE_TIME;
                    this.recoveryDeadline = now + LOBBY_TIMEOUT;
                    return;
                }
                if (now >= this.recoveryDeadline) this.scheduleReconnect('&eConnection timed out; retrying...');
                return;
            case RECOVERY_STATE.LEAVING_LIMBO:
                if (!World.isLoaded()) {
                    if (now >= this.recoveryDeadline) this.beginReconnect('The /lobby command did not load a lobby.', false);
                    return;
                }
                if (this.isInSkyblock()) return this.completeRecovery();
                if (now < this.recoveryAt) return;
                if (this.joinSkyblockFromLobby()) return;
                if (now >= this.recoveryDeadline) this.beginReconnect('The /lobby command did not leave Limbo.', true);
                return;
            case RECOVERY_STATE.SETTLING:
                if (!World.isLoaded()) {
                    if (now >= this.recoveryDeadline) this.scheduleReconnect('&eLobby did not load; retrying...');
                    return;
                }
                if (this.isInSkyblock()) return this.completeRecovery();
                if (now < this.recoveryAt) return;
                if (this.joinSkyblockFromLobby()) return;
                if (now >= this.recoveryDeadline) this.beginLimboRecovery('Connected outside the main lobby and SkyBlock.');
                return;
            case RECOVERY_STATE.JOINING_SKYBLOCK:
                if (this.isInSkyblock()) return this.completeRecovery();
                if (now < this.recoveryDeadline) return;
                if (World.isLoaded()) {
                    if (this.recoverySawWorldUnload) {
                        this.beginLimboRecovery('The /skyblock transfer did not reach SkyBlock.');
                    } else {
                        this.lobbyConfirmed = true;
                        this.recoveryState = RECOVERY_STATE.SETTLING;
                        this.recoveryAt = now + 1_000;
                        this.recoveryDeadline = now + LOBBY_TIMEOUT;
                    }
                } else {
                    this.scheduleReconnect('&eSkyBlock did not load; reconnecting...');
                }
        }
    }

    connectToHypixel() {
        this.recoveryState = RECOVERY_STATE.CONNECTING;
        this.recoveryDeadline = Date.now() + CONNECT_TIMEOUT;
        this.message('&eConnecting to Hypixel...');
        Client.connect(HYPIXEL_ADDRESS);
    }

    scheduleReconnect(message) {
        if (message) this.message(message);
        this.recoveryState = RECOVERY_STATE.WAITING;
        this.recoveryAt = Date.now() + RECONNECT_DELAY;
        this.recoveryDeadline = 0;
    }

    isInMainLobby() {
        if (!World.isLoaded() || this.isInSkyblock()) return false;
        return (Player.getInventory()?.getItems() || []).slice(0, 9).some((item) => {
            const name = clean(item?.getName?.());
            const type = clean(item?.getType?.()?.getRegistryName?.());
            return name.includes('game menu') || type.includes('compass');
        });
    }

    joinSkyblockFromLobby() {
        if (!this.lobbyConfirmed && !this.isInMainLobby()) return false;
        this.recoverySawWorldUnload = false;
        this.recoveryState = RECOVERY_STATE.JOINING_SKYBLOCK;
        this.recoveryDeadline = Date.now() + SKYBLOCK_JOIN_TIMEOUT;
        this.message('&eMain lobby detected. Running /skyblock...');
        ChatLib.command('skyblock');
        return true;
    }

    isInSkyblock() {
        if (!World.isLoaded()) return false;
        if ((Player.getInventory()?.getItems() || []).some((item) => clean(item?.getName?.()).startsWith('skyblock menu'))) return true;
        try {
            if (clean(Scoreboard.getTitle()).includes('skyblock')) return true;
        } catch (error) {}
        try {
            const currentArea = area();
            if (typeof currentArea === 'string' && currentArea.trim() && !/^(?:unknown|limbo)$/i.test(currentArea.trim())) return true;
        } catch (error) {}
        try {
            return (TabList.getNames?.() || []).some((line) => /^(?:area|profile|purse|bits):/i.test(clean(line)));
        } catch (error) {
            return false;
        }
    }

    completeRecovery() {
        if (!this.isInSkyblock()) return;
        const macros = [...this.recoveryMacros];
        const remaining = this.recoverySessionRemainingMs;
        this.resetRecovery();
        this.trackedMacros = macros;
        this.timerEnd = Date.now() + remaining;
        this.startTrackedMacros();
        this.saveState();
        this.message(`&aBack in SkyBlock. Resumed ${macros.length} tracked macro${macros.length === 1 ? '' : 's'}.`);
        this.sendSchedulerConnectEmbed();
    }

    abortRecovery(message) {
        const remaining = this.recoverySessionRemainingMs;
        this.resetRecovery();
        this.pausedRemainingMs = remaining;
        this.timerEnd = 0;
        this.state = STATE.PAUSED;
        this.saveState();
        this.updateOverlay();
        this.message(`&c${message} Scheduler paused.`);
    }

    resetRecovery() {
        this.recoveryState = null;
        this.recoveryAt = 0;
        this.recoveryDeadline = 0;
        this.recoveryMacros = [];
        this.recoverySessionRemainingMs = 0;
        this.recoverySawWorldUnload = false;
        this.lobbyConfirmed = false;
        this.outsideSkyblockSince = 0;
    }

    pauseSession() {
        this.pausedRemainingMs = Math.max(0, this.timerEnd - Date.now());
        this.timerEnd = 0;
        this.state = STATE.PAUSED;
        this.saveState();
        this.updateOverlay();
    }

    handlePaused() {
        const enabled = this.getSchedulableMacros();

        if (enabled.length > 0) {
            this.trackedMacros = [...enabled];
            this.timerEnd = Date.now() + this.pausedRemainingMs;
            this.pausedRemainingMs = 0;
            this.state = STATE.RUNNING;
            this.saveState();
            this.updateOverlay();
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
            this.message('&eConnecting to Hypixel...');
            Client.connect(HYPIXEL_ADDRESS);
            this.returnStep = 1;
            this.timerEnd = now + 12000;
            this.saveState();
            return;
        }

        if (this.returnStep === 1) {
            if (!World.isLoaded()) {
                if (now < this.timerEnd) return;
                this.message('&eRetrying connection...');
                Client.connect(HYPIXEL_ADDRESS);
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
            if (this.isInSkyblock()) return this.finishScheduledReturn();
            this.message('&eJoining SkyBlock with /skyblock...');
            ChatLib.command('skyblock');
            this.returnStep = 3;
            this.timerEnd = Date.now() + SKYBLOCK_JOIN_TIMEOUT;
            this.saveState();
            return;
        }

        if (this.returnStep === 3) {
            if (this.isInSkyblock()) return this.finishScheduledReturn();
            if (now < this.timerEnd) return;
            if (!World.isLoaded()) {
                this.returnStep = 0;
                this.timerEnd = 0;
            } else if (this.isInMainLobby()) {
                this.message('&eRetrying /skyblock...');
                ChatLib.command('skyblock');
                this.timerEnd = now + SKYBLOCK_JOIN_TIMEOUT;
            } else {
                this.message('&eLeaving Limbo with /lobby...');
                ChatLib.command('lobby');
                this.returnStep = 2;
                this.timerEnd = now + LOBBY_SETTLE_TIME;
            }
            this.saveState();
        }
    }

    finishScheduledReturn() {
        this.message('&aStarting macros.');
        this.startTrackedMacros();
        this.sendSchedulerConnectEmbed();
        this.beginSession();
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
        const breakTime = formatDurationMs(this.breakDurationMs);
        const cleanBreakTime = breakTime.includes(' ') ? breakTime.replace(/ (?=[^ ]+$)/, ' and ') : breakTime;

        this.stopTrackedMacros();
        this.sendSchedulerDisconnectEmbed(cleanBreakTime);

        this.state = STATE.RESTING;
        this.timerEnd = Date.now() + this.breakDurationMs;
        this.saveState();
        this.updateOverlay();

        const reason = `Scheduler: Resting for ${cleanBreakTime}`;
        this.disconnect(reason);
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

        Webhook.takeScreenshot(`Disabled ${macroName}`, getModuleDuration(macroName));

        if (this.trackedMacros.length === 0) {
            this.state = STATE.IDLE;
            this.timerEnd = 0;
            this.breakDurationMs = 0;
            this.returnStep = 0;
            this.message(`&e${macroName} disabled.`);
        } else {
            this.message(`&e${macroName} disabled, ${this.trackedMacros.length} others remaining.`);
        }

        this.saveState();
        this.updateOverlay();
        return true;
    }

    startTrackedMacros() {
        this.trackedMacros.forEach((name) => {
            const module = getModule(name);
            if (module && module.isMacro && !module.enabled) module.toggle(true, false, 'scheduler');
        });
    }

    stopTrackedMacros() {
        this.trackedMacros.forEach((name) => {
            const module = getModule(name);
            if (module && module.isMacro) module.toggle(false, true, 'scheduler');
        });
    }

    sendSchedulerDisconnectEmbed(cleanBreakTime) {
        const lines = [];

        this.trackedMacros.forEach((name) => {
            const meta = getLastDisableMeta(name);
            if (!meta || meta.context !== 'scheduler') return;

            const macroLines = [];
            const runtime = getModuleDuration(name);
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
        Webhook.publish(
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

    getMacroOverlayStats(macroName) {
        const module = getModule(macroName);
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
                } catch (e) {
                    console.error(e);
                }
            });
        });

        return lines;
    }

    getSchedulableMacros() {
        return getEnabledMacros().filter((name) => {
            const module = getModule(name);
            return module && module.isMacro && !module.isParentManaged;
        });
    }

    disconnect(reason) {
        try {
            const mc = Client.getMinecraft();
            if (mc.getConnection()) {
                const text = net.minecraft.network.chat.Component.literal(String(reason ?? ''));
                mc.getConnection().getConnection().disconnect(text);
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
        if (this.recoveryState) return `Paused (${formatDurationMs(this.recoverySessionRemainingMs)})`;

        const remaining = this.state === STATE.PAUSED ? Math.max(0, this.pausedRemainingMs) : Math.max(0, this.timerEnd - Date.now());
        const timeStr = formatDurationMs(remaining);

        if (this.state === STATE.RETURNING) return `Returning (${timeStr})`;
        if (this.state === STATE.PAUSED) return `Paused (${timeStr})`;
        return timeStr;
    }

    getActiveMacroDisplay() {
        if (this.trackedMacros.length === 0) return 'None';
        if (this.trackedMacros.length === 1) return this.trackedMacros[0];
        return `${this.trackedMacros[0]} +${this.trackedMacros.length - 1}`;
    }
}

new MacroScheduler();
