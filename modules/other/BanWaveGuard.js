import { Categories } from '../../gui/categories/CategorySystem';
import { notificationManager } from '../../gui/NotificationManager';
import { GuiState, Overlays } from '../../gui/core/GuiState';
import { drawRoundedRectangleWithBorder, drawText, FontSizes, getTextWidth, THEME } from '../../gui/Utils';
import { getModule, modules, setModuleEnableBlockReason } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { fetchURL } from '../../utils/NetworkUtils';
import { getConfigFile, writeConfigFile } from '../../utils/Utils';

const POLL_INTERVAL_MS = 30000;
const STATE_FILE = 'ban_wave_guard.json';
const HISTORY_FILE = 'ban_wave_history.json';
const WINDOW_MS = 15 * 60000;
const MAX_SAMPLE_GAP_MS = 90000;

class BanWaveGuard extends ModuleBase {
    constructor() {
        super({
            name: 'Ban Wave Guard',
            subcategory: 'Core',
            description: 'Stops features when Hypixel punishment statistics exceed a threshold.',
            hideInModules: true,
        });

        this.monitoring = true;
        this.apiKey = '';
        this.source = 'Plancke';
        this.staffThreshold = 30;
        this.threshold = 50;
        this.checkWatchdog = false;
        this.samples = [];
        this.lastStats = null;
        this.nextPollAt = 0;
        this.polling = false;
        this.generation = 0;
        this.lastWarning = '';
        this.showHud = true;
        this.hudX = 98;
        this.hudY = 10;
        this.hudScale = 1;
        this.hudRegistration = null;
        this.hudRenderCallback = () => this.renderHud();
        const savedState = getConfigFile(STATE_FILE);
        this.locked = savedState?.locked === true;
        this.lockReason = typeof savedState?.reason === 'string' ? savedState.reason : '';
        if (this.locked) setModuleEnableBlockReason('Hypixel ban wave protection is locked.');

        const section = 'Ban Wave Guard';
        this.addDirectToggle(
            'Show Banwave HUD',
            (value) => (this.showHud = !!value),
            'Shows banwave status in game, including while protection is locked.',
            true,
            section
        );
        this.addDirectSlider(
            'HUD Horizontal Position (%)',
            0,
            100,
            this.hudX,
            (value) => (this.hudX = Number(value)),
            'Left to right position on screen.',
            section
        );
        this.addDirectSlider(
            'HUD Vertical Position (%)',
            0,
            100,
            this.hudY,
            (value) => (this.hudY = Number(value)),
            'Top to bottom position on screen.',
            section
        );
        this.addDirectSlider('HUD Scale (%)', 60, 180, 100, (value) => (this.hudScale = Number(value) / 100), 'Size of the banwave panel.', section);
        this.addDirectToggle(
            'Stop on Ban Wave',
            (value) => {
                const monitoring = !!value;
                if (monitoring === this.monitoring) return;
                this.monitoring = monitoring;
                this.resetPolling();
            },
            'Checks ban statistics every 30 seconds. Disabling monitoring does not clear an existing lock.',
            true,
            section
        );
        this.addDirectMultiToggle(
            'Statistics Source',
            ['Plancke', 'Hypixel API'],
            true,
            (value) => {
                const selected = Array.isArray(value) ? value.find((option) => option.enabled)?.name : value;
                const source = selected === 'Hypixel API' ? 'Hypixel API' : 'Plancke';
                if (source === this.source) return;
                this.source = source;
                this.resetPolling();
                this.loadHistory();
            },
            'Plancke needs no key. Hypixel API uses your configured API key. Requests run from your own game connection.',
            'Plancke',
            section
        );
        Categories.addSettingsTextInput(
            'Hypixel API Key',
            '',
            (value) => {
                this.apiKey = String(value || '').trim();
                if (this.source === 'Hypixel API') this.resetPolling();
            },
            'Only required when Statistics Source is Hypixel API. Stored locally; do not share your V5 config.',
            section
        );
        this.addDirectSlider(
            'Staff Bans In 15 Minutes',
            1,
            200,
            this.staffThreshold,
            (value) => {
                this.staffThreshold = Math.max(1, Math.round(Number(value) || 30));
            },
            'Stop when the observed staff_total increase within the last 15 minutes reaches this number.',
            section
        );
        this.addDirectToggle(
            'Also Check Watchdog',
            (value) => (this.checkWatchdog = !!value),
            'Additionally stop when Watchdog Bans Per Minute is reached. Disabled by default.',
            false,
            section
        );
        this.addDirectSlider(
            'Watchdog Bans Per Minute',
            1,
            500,
            this.threshold,
            (value) => {
                this.threshold = Math.max(1, Math.round(Number(value) || 50));
            },
            'Stop when watchdog_lastMinute reaches this number. This is a heuristic, not an official ban-wave signal.',
            section
        );
        Categories.addSettingsButton(
            'Unlock Features',
            () => this.unlock(),
            'Clears the protection lock. Features and scheduler must be enabled manually. Monitoring can lock again.',
            section
        );
        Categories.addSettingsButton('Monitoring Status', () => this.showStatus(), 'Shows source, observed bans, sample coverage, and errors.', section);

        this.loadHistory();

        this.refreshHud();
        register('step', () => {
            this.poll();
            this.refreshHud();
        }).setFps(1);
        register('tick', () => this.syncHudRegistration());
        register('worldUnload', () => this.hideHud());
        register('gameUnload', () => {
            this.generation++;
            this.hideHud();
        });
        Client.scheduleTask(20, () => {
            if (this.locked) this.message('&cFeatures are locked by ban wave protection. Use Settings > Ban Wave Guard > Unlock Features to reset.');
        });
    }

    resetPolling() {
        this.generation++;
        this.nextPollAt = 0;
        this.lastWarning = '';
        this.lastStats = null;
    }

    loadHistory() {
        this.samples = [];
        const history = getConfigFile(HISTORY_FILE);
        if (history?.source !== this.source || !Array.isArray(history.samples)) return;
        const now = Date.now();
        this.samples = history.samples.filter(
            (sample) => Number.isFinite(sample?.time) && sample.time <= now && now - sample.time <= WINDOW_MS && this.isCount(sample.total)
        );
        if (
            this.samples.some(
                (sample, index) =>
                    index > 0 &&
                    (sample.time <= this.samples[index - 1].time ||
                        sample.time - this.samples[index - 1].time > MAX_SAMPLE_GAP_MS ||
                        sample.total < this.samples[index - 1].total)
            )
        ) {
            this.samples = [];
        }
    }

    warn(message) {
        if (this.lastWarning === message) return;
        this.lastWarning = message;
        this.message(`&e${message}`);
    }

    poll() {
        if (!this.monitoring || this.locked || this.polling || Date.now() < this.nextPollAt) return;
        if (this.source === 'Hypixel API' && !this.apiKey) {
            this.warn('Ban wave monitoring is inactive: configure a Hypixel API Key in Settings > Ban Wave Guard.');
            return;
        }

        this.polling = true;
        this.nextPollAt = Date.now() + POLL_INTERVAL_MS;
        const generation = this.generation;
        const apiKey = this.apiKey;
        const source = this.source;
        const thread = new java.lang.Thread(() => {
            let stats = null;
            try {
                const response =
                    source === 'Plancke'
                        ? fetchURL('https://api.plancke.io/hypixel/v1/punishmentStats')
                        : fetchURL('https://api.hypixel.net/v2/punishmentstats', { 'API-Key': apiKey });
                const data = response ? JSON.parse(response) : null;
                const record = source === 'Plancke' ? data?.record : data;
                if (data?.success === true && this.isCount(record?.staff_total) && this.isCount(record?.watchdog_lastMinute)) {
                    stats = { staffTotal: record.staff_total, watchdogLastMinute: record.watchdog_lastMinute, time: Date.now() };
                }
            } catch (e) {
                // Response bodies may contain credentials, so only report a fixed error below.
            }
            Client.scheduleTask(0, () => {
                this.polling = false;
                if (generation !== this.generation || !this.monitoring || this.locked) return;
                if (stats === null || Date.now() - stats.time > MAX_SAMPLE_GAP_MS) {
                    this.warn(`${source} statistics unavailable. Protection has no current data; retrying in 30 seconds. Check Monitoring Status.`);
                    return;
                }
                this.lastWarning = '';
                this.acceptStats(stats);
            });
        });
        thread.setDaemon(true);
        thread.start();
    }

    isCount(value) {
        return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    }

    acceptStats(stats) {
        const previous = this.samples[this.samples.length - 1];
        if (previous && (stats.time <= previous.time || stats.time - previous.time > MAX_SAMPLE_GAP_MS || stats.staffTotal < previous.total)) {
            this.samples = [];
        }
        this.samples = this.samples.filter((sample) => stats.time - sample.time <= WINDOW_MS);
        this.samples.push({ time: stats.time, total: stats.staffTotal });
        const staffBans = stats.staffTotal - this.samples[0].total;
        const coverageMinutes = (stats.time - this.samples[0].time) / 60000;
        this.lastStats = { ...stats, staffBans, coverageMinutes };
        writeConfigFile(HISTORY_FILE, { source: this.source, samples: this.samples });

        if (staffBans >= this.staffThreshold) {
            this.stopFeatures(`${staffBans} staff bans in ${coverageMinutes.toFixed(1)} observed minutes`);
        } else if (this.checkWatchdog && stats.watchdogLastMinute >= this.threshold) {
            this.stopFeatures(`${stats.watchdogLastMinute} Watchdog bans in the last minute`);
        }
    }

    showStatus() {
        const stats = this.lastStats;
        this.message(`Source: ${this.source}. Monitoring: ${this.monitoring ? 'on' : 'off'}. Features: ${this.locked ? 'LOCKED' : 'unlocked'}.`);
        if (this.lastWarning) this.message(`&e${this.lastWarning}`);
        if (!stats) {
            this.message('&eWaiting for statistics. Staff detection needs at least two successful samples.');
            return;
        }
        const age = Math.max(0, Math.round((Date.now() - stats.time) / 1000));
        this.message(
            `Staff: ${stats.staffBans}/${this.staffThreshold} in ${stats.coverageMinutes.toFixed(1)} observed minutes (up to 15). Watchdog: ${stats.watchdogLastMinute}/min. Updated ${age}s ago.`
        );
    }

    refreshHud() {
        const stats = this.lastStats;
        const age = stats ? Math.max(0, Math.floor((Date.now() - stats.time) / 1000)) : null;
        let status = 'MONITORING';
        let color = 'NOTIF_SUCCESS';
        if (this.locked) {
            status = 'BANWAVE - FEATURES LOCKED';
            color = 'NOTIF_ERROR';
        } else if (!this.monitoring) {
            status = 'MONITORING OFF';
            color = 'TEXT_MUTED';
        } else if (this.source === 'Hypixel API' && !this.apiKey) {
            status = 'API KEY REQUIRED';
            color = 'NOTIF_WARNING';
        } else if (this.lastWarning || (stats && Date.now() - stats.time > MAX_SAMPLE_GAP_MS)) {
            status = 'DATA UNAVAILABLE';
            color = 'NOTIF_WARNING';
        } else if (!stats || this.samples.length < 2) {
            status = stats ? 'COLLECTING SAMPLES' : 'CONNECTING';
            color = 'NOTIF_WARNING';
        }

        const lines = [
            `Source: ${this.source}`,
            `Staff bans: ${stats ? stats.staffBans : '--'} / ${this.staffThreshold}`,
            `Observed window: ${stats ? stats.coverageMinutes.toFixed(1) : '0.0'} / 15 min`,
            `Watchdog: ${stats ? stats.watchdogLastMinute : '--'}/min (check ${this.checkWatchdog ? 'on' : 'off'})`,
            `Last update: ${age === null ? 'waiting for data' : `${age}s ago`}`,
        ];
        if (this.locked) {
            if (this.lockReason) lines.push(this.lockReason);
            lines.push('Unlock: Settings > Ban Wave Guard');
        } else if (this.monitoring && this.lastWarning) {
            lines.push('Check Monitoring Status in Settings');
        }
        this.hudSnapshot = { status, color, lines };
    }

    syncHudRegistration() {
        const visible = this.showHud && World.isLoaded() && !GuiState.myGui.isOpen() && !Overlays.Gui.isOpen();
        if (visible && !this.hudRegistration) {
            this.hudRegistration = Render2D.registerV5CachedRender(this.hudRenderCallback);
        } else if (!visible) {
            this.hideHud();
        }
    }

    hideHud() {
        if (!this.hudRegistration) return;
        Render2D.unregisterV5Render(this.hudRegistration);
        this.hudRegistration = null;
    }

    renderHud() {
        if (!this.showHud || !World.isLoaded() || !this.hudSnapshot) return;
        const sw = Render2D.screen.getWidth();
        const sh = Render2D.screen.getHeight();
        if (sw <= 0 || sh <= 0) return;
        const { status, color, lines } = this.hudSnapshot;
        const title = 'Banwave Monitor';
        const baseWidth =
            Math.max(
                200,
                getTextWidth(title, FontSizes.LARGE),
                getTextWidth(status, FontSizes.REGULAR),
                ...lines.map((line) => getTextWidth(line, FontSizes.REGULAR))
            ) + 20;
        const baseHeight = 46 + lines.length * 14;
        const scale = Math.min(Math.max(0.6, this.hudScale || 1), (sw - 4) / baseWidth, (sh - 4) / baseHeight);
        if (scale <= 0) return;
        const width = baseWidth * scale;
        const height = baseHeight * scale;
        const x = 2 + (Math.max(0, sw - width - 4) * Math.max(0, Math.min(100, this.hudX || 0))) / 100;
        const y = 2 + (Math.max(0, sh - height - 4) * Math.max(0, Math.min(100, this.hudY || 0))) / 100;
        const accent = THEME[color];
        drawRoundedRectangleWithBorder({ x, y, width, height, radius: 6 * scale, color: THEME.BG_COMPONENT, borderWidth: scale, borderColor: accent });
        drawText(title, x + 10 * scale, y + 14 * scale, FontSizes.LARGE * scale, THEME.TEXT);
        drawText(status, x + 10 * scale, y + 30 * scale, FontSizes.REGULAR * scale, accent);
        lines.forEach((line, index) => drawText(line, x + 10 * scale, y + (46 + index * 14) * scale, FontSizes.REGULAR * scale, THEME.TEXT_MUTED));
    }

    stopFeatures(reason) {
        if (this.locked) return;
        this.locked = true;
        this.lockReason = reason;
        this.refreshHud();
        setModuleEnableBlockReason('Hypixel ban wave protection is locked.');
        const persisted = writeConfigFile(STATE_FILE, { locked: true, detectedAt: Date.now(), source: this.source, reason });
        if (!persisted) this.message('&cCould not save the protection lock. It will only last until scripts are reloaded.');

        try {
            getModule('Scheduler')?.stopForBanWave();
        } catch (e) {
            console.error('Unable to reset scheduler during ban wave protection.');
        }
        for (const module of modules.values()) {
            if (!module.enabled) continue;
            try {
                module.toggle(false, false, 'ban-wave');
            } catch (e) {
                console.error(`Unable to disable ${module.name} during ban wave protection.`);
            }
        }

        this.message(`&cPossible Hypixel ban wave: ${reason}. Features stopped and locked. Unlock manually in Settings > Ban Wave Guard.`);
        notificationManager.add('Ban Wave Protection', `${reason}. Features stopped. Unlock manually in Settings.`, 'ERROR', 15000);
    }

    unlock() {
        if (!writeConfigFile(STATE_FILE, { locked: false })) {
            this.message('&cCould not save the unlocked state. Protection remains locked.');
            return;
        }
        this.locked = false;
        this.lockReason = '';
        setModuleEnableBlockReason(null);
        this.generation++;
        this.nextPollAt = 0;
        this.refreshHud();
        this.message('&aProtection lock cleared. Enable desired features and scheduler manually.');
    }
}

new BanWaveGuard();
