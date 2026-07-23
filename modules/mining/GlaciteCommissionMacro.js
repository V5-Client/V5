import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { OverlayManager } from '../../gui/OverlayUtils';
import { CommissionClaimer } from '../../utils/CommissionUtils';
import { MacroState } from '../../utils/MacroState';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { finiteNumber } from '../../utils/NumberUtils';
import { EtherwarpPathfinder } from '../../utils/pathfinder/EtherwarpPathfinder';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { manager } from '../../utils/SkyblockEvents';
import { TabListUtils } from '../../utils/TabListUtils';
import { Mouse } from '../../utils/Ungrab';
import { MiningBot } from './MiningBot';
import { tunnelsMiner } from './TunnelsMiner';
import { Utils } from '../../utils/Utils';

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    MINING: 'Mining',
    CLAIMING: 'Claiming Rewards',
    WAITING_GUI_CLOSE: 'Closing GUI',
    WAITING_COLD: 'Waiting for Cold',
};

const SUPPORTED_ORES = ['glacite', 'umber', 'tungsten', 'peridot', 'aquamarine', 'onyx', 'citrine'];
const EMISSARY_LOCATION = [2, 121, 237];
const TRAVEL_MODES = ['Walk', 'Etherwarp'];

class GlaciteCommissionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Glacite Commission Macro',
            subcategory: 'Mining',
            developerMode: true,
            description: 'Completes Glacite mining commissions with Tunnels Miner',
            tooltip: 'Reads Glacite commissions from tab, mines required tunnel ores, and claims with pigeon or emissary.',
            theme: '#88d7ff',
            autoDisableOnWorldUnload: false,
            isMacro: true,
        });

        this.bindToggleKey();

        this.currentState = STATES.IDLE;
        this.travelMode = TRAVEL_MODES[0];
        this.coldThreshold = 20;
        this.pauseTicks = 0;
        this.commissions = [];
        this.currentCommission = null;
        this.activeOreTypes = [];
        this.awaitingTabUpdate = false;
        this.ignoreTabUpdatesUntil = 0;
        this.lastCommissionSyncSource = null;
        this.lastCompletedCommissionName = null;
        this.pendingMiningStart = false;
        this.lastTunnelRestartAt = 0;
        this.noSupportedMessageAt = 0;
        this.drill = null;
        this.commissionClaimer = new CommissionClaimer({
            getLocations: () => [EMISSARY_LOCATION],
            ensureToolEquipped: () => this.ensureDrillEquippedForClaim(),
            isClaiming: () => this.enabled && this.currentState === STATES.CLAIMING,
            delay: (ticks) => this.delay(ticks),
            onClaimsExhausted: (container) => {
                this.updateCommissionsFromGui(container);
                Guis.closeInv();
                this.setState(STATES.WAITING_GUI_CLOSE);
            },
            onPathFailed: () => {
                this.message('&cFailed to reach Glacite emissary.');
                this.setState(STATES.CHOOSING);
                this.delay(20);
            },
            useEtherwarp: () => this.travelMode === 'Etherwarp',
        });

        this.addMultiToggle(
            'Travel Mode',
            TRAVEL_MODES,
            true,
            (selected) => {
                const enabled = Array.isArray(selected) ? selected.find((item) => item.enabled) : null;
                this.travelMode = enabled?.name || TRAVEL_MODES[0];
            },
            'How the macro travels to tunnel veins.',
            TRAVEL_MODES[0]
        );

        this.addSlider('Cold Warp Threshold', 10, 90, this.coldThreshold, (value) => (this.coldThreshold = value));

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        State: () => this.currentState,
                        Commission: () => this.currentCommission?.name || 'None',
                        Ores: () => this.getOreDisplay(),
                    },
                },
                {
                    title: 'Profits',
                    data: {
                        'Completed Commissions': () => this.getCompletedCommissions(),
                        'Commissions/hr': () => this.getCommissionsPerHourDisplay(),
                    },
                },
            ],
            {
                sessionTrackedValues: {
                    commissionsCompleted: 0,
                },
            }
        );

        this.on('step', () => {
            if (!this.enabled) return;
            const newCommissions = TabListUtils.readCommissions();
            this.updateCommissionsIfChanged(newCommissions);
        }).setDelay(1);

        this.on('tick', () => this.runLogic());

        this.on('chat', (event) => {
            const msg = event.message.getUnformattedText();
            if (msg?.includes('Commission Complete! Visit the King to claim')) {
                OverlayManager.incrementTrackedValue(this.oid, 'commissionsCompleted');
                this.onCommissionComplete();
            }
        });

        manager.subscribe('death', () => {
            if (this.enabled) this.delayedReset(10);
        });

        manager.subscribe('serverchange', () => {
            if (this.enabled) this.delayedReset(40);
        });

        this.on('worldUnload', () => {
            if (this.enabled) this.delayedReset(40);
        });
    }

    onEnable() {
        this.message('&aEnabled');
        Mouse.ungrab();
        this.resetState();
        this.refreshDrillReference();

        if (!this.drill) {
            this.message('&cNo drill or pickaxe found in hotbar!');
            this.toggle(false);
            return;
        }
    }

    onDisable() {
        this.message('&cDisabled');
        this.resetState();
        Mouse.regrab();
    }

    resetState() {
        this.currentState = STATES.IDLE;
        this.pauseTicks = 0;
        this.commissions = [];
        this.currentCommission = null;
        this.activeOreTypes = [];
        this.awaitingTabUpdate = false;
        this.ignoreTabUpdatesUntil = 0;
        this.lastCommissionSyncSource = null;
        this.lastCompletedCommissionName = null;
        this.pendingMiningStart = false;
        this.lastTunnelRestartAt = 0;
        this.noSupportedMessageAt = 0;
        this.areaCheckTime = null;
        this.commissionClaimer.cancelNpcRotation();
        this.stopTunnelMiner();
        EtherwarpPathfinder.cancel(true);
        Pathfinder.resetPath(true);
    }

    delayedReset(delay) {
        const waitingForCold = this.currentState === STATES.WAITING_COLD;
        this.resetState();
        if (waitingForCold) this.setState(STATES.WAITING_COLD);
        this.delay(delay);
    }

    runLogic() {
        if (!this.enabled) return;
        if (!Player.getPlayer()) return;

        const cold = MiningUtils.getDebuff('cold');
        if (this.currentState === STATES.WAITING_COLD) {
            if (cold > 0) return;
            this.setState(STATES.CHOOSING);
            this.pauseTicks = 0;
        } else if (cold > this.coldThreshold) {
            this.stopTunnelMiner();
            this.setState(STATES.WAITING_COLD);
            this.message(`&eCold exceeded ${this.coldThreshold}, warping to camp...`);
            ChatLib.command('warp camp');
            return;
        }

        this.commissionClaimer.cancelNpcRotationIfPathing();

        if (this.pauseTicks > 0) {
            this.pauseTicks--;
            return;
        }

        switch (this.currentState) {
            case STATES.IDLE:
                this.setState(STATES.CHOOSING);
                break;
            case STATES.CHOOSING:
                this.handleChoosing();
                break;
            case STATES.MINING:
                this.handleMining();
                break;
            case STATES.CLAIMING:
                this.handleClaiming();
                break;
            case STATES.WAITING_GUI_CLOSE:
                this.handleWaitingGuiClose();
                break;
            default:
                break;
        }
    }

    handleChoosing() {
        const area = Utils.area();
        const subarea = Utils.subArea();
        const now = Date.now();
        const validSubareas = ['Glacite Tunnels', 'Fossil Research Center', 'Dwarven Base Camp'];
        if (area !== 'Dwarven Mines' || !validSubareas.includes(subarea)) {
            if (!this.areaCheckTime) {
                this.message('&eNot in the Glacite area, warping to camp...');
                ChatLib.command('warp camp');
                this.areaCheckTime = now;
                return;
            }
            if (now - this.areaCheckTime > 10000) {
                ChatLib.command('warp camp');
                this.areaCheckTime = now;
            }
            return;
        }
        this.areaCheckTime = null;
        const newCommissions = TabListUtils.readCommissions();
        this.updateCommissionsIfChanged(newCommissions);

        if (this.shouldWaitForLastCompleted()) return;
        if (this.awaitingTabUpdate) return;

        const completedCommission = this.findCompletedSupportedCommission();
        if (completedCommission) {
            this.currentCommission = completedCommission;
            this.onCommissionComplete();
            return;
        }

        const supportedCommissions = this.getSupportedActiveCommissions();
        if (!supportedCommissions.length) {
            this.stopTunnelMiner();
            this.activeOreTypes = [];
            this.currentCommission = null;
            this.notifyNoSupportedCommissions();
            this.delay(10);
            return;
        }

        this.startMiningCommissions(supportedCommissions);
    }

    handleMining() {
        const newCommissions = TabListUtils.readCommissions();
        this.updateCommissionsIfChanged(newCommissions);

        if (this.shouldWaitForLastCompleted()) return;
        if (this.awaitingTabUpdate) return;

        const completedCommission = this.findCompletedSupportedCommission();
        if (completedCommission) {
            this.currentCommission = completedCommission;
            this.onCommissionComplete();
            return;
        }

        const supportedCommissions = this.getSupportedActiveCommissions();
        if (!supportedCommissions.length) {
            this.stopTunnelMiner();
            this.activeOreTypes = [];
            this.currentCommission = null;
            this.setState(STATES.CHOOSING);
            return;
        }

        const neededOres = this.collectOreTypes(supportedCommissions);
        if (!this.sameStringArrays(neededOres, this.activeOreTypes)) {
            this.startMiningCommissions(supportedCommissions);
            return;
        }

        const now = Date.now();
        if (!Pathfinder.isPathing() && !EtherwarpPathfinder.isPathing() && !MiningBot.enabled && now - this.lastTunnelRestartAt >= 5000) {
            tunnelsMiner.restart();
            this.lastTunnelRestartAt = now;
        }
    }

    handleClaiming() {
        this.commissionClaimer.handle();
    }

    handleWaitingGuiClose() {
        if (Client.isInGui()) return;

        this.refreshDrillReference();

        if (this.pendingMiningStart && this.activeOreTypes.length > 0) {
            this.pendingMiningStart = false;
            this.beginTunnelMiner();
            return;
        }

        this.setState(STATES.CHOOSING);
    }

    startMiningCommissions(commissions) {
        const neededOres = this.collectOreTypes(commissions);
        if (!neededOres.length) return;

        this.currentCommission = commissions[0];
        this.activeOreTypes = neededOres;
        this.noSupportedMessageAt = 0;
        if (Client.isInGui()) {
            this.pendingMiningStart = true;
            Guis.closeInv();
            this.setState(STATES.WAITING_GUI_CLOSE);
            return;
        }

        this.beginTunnelMiner();
    }

    beginTunnelMiner() {
        tunnelsMiner.setSelectedOreNames(this.activeOreTypes);
        tunnelsMiner.setTravelMode(this.travelMode);
        if (tunnelsMiner.enabled) {
            tunnelsMiner.restart();
        } else {
            tunnelsMiner.toggle(true, true);
        }

        this.lastTunnelRestartAt = Date.now();
        this.setState(STATES.MINING);
    }

    stopTunnelMiner() {
        if (tunnelsMiner.enabled) tunnelsMiner.toggle(false, true);
        if (MiningBot.enabled) MiningBot.toggle(false, true);
    }

    onCommissionComplete() {
        this.stopTunnelMiner();
        Pathfinder.resetPath();
        this.pendingMiningStart = false;
        this.awaitingTabUpdate = true;
        this.lastCompletedCommissionName = this.currentCommission?.name || null;
        this.setState(STATES.CLAIMING);
    }

    updateCommissionsFromGui(container) {
        const newCommissions = MiningUtils.readCommissionsFromGui(container, (name) => this.isSupportedCommissionName(name));
        if (!newCommissions.length) return;

        this.commissions = newCommissions;
        this.awaitingTabUpdate = false;
        this.lastCommissionSyncSource = 'GUI';
        this.ignoreTabUpdatesUntil = Date.now() + 5000;

        const currentName = this.currentCommission?.name;
        const matching = currentName ? this.commissions.find((commission) => commission.name === currentName) : null;
        if (!matching || matching.progress === 1) {
            this.currentCommission = null;
        }
    }

    refreshDrillReference() {
        const drills = MiningUtils.getDrills();
        this.drill = drills.drill;
        if (this.drill) Guis.setItemSlot(this.drill.slot);
    }

    ensureDrillEquippedForClaim() {
        if (!this.drill) this.refreshDrillReference();
        if (!this.drill) return true;

        if (Player.getHeldItemIndex() !== this.drill.slot) {
            Guis.setItemSlot(this.drill.slot);
            this.delay(3);
            return false;
        }

        return true;
    }

    findCompletedSupportedCommission() {
        return this.commissions.find((commission) => commission.progress === 1 && this.isSupportedCommissionName(commission.name));
    }

    getSupportedActiveCommissions() {
        return this.commissions.filter((commission) => commission.progress < 1 && this.isSupportedCommissionName(commission.name));
    }

    collectOreTypes(commissions) {
        const oreSet = new Set();
        commissions.forEach((commission) => {
            this.extractOreTypesFromName(commission.name).forEach((ore) => oreSet.add(ore));
        });
        return SUPPORTED_ORES.filter((ore) => oreSet.has(ore));
    }

    extractOreTypesFromName(name) {
        if (!name) return [];

        const lowerName = String(name).toLowerCase();
        if (/\d/.test(lowerName)) return [];
        if (lowerName.includes('powder')) return [];

        return SUPPORTED_ORES.filter((ore) => lowerName.includes(ore));
    }

    isSupportedCommissionName(name) {
        return this.extractOreTypesFromName(name).length > 0;
    }

    shouldWaitForLastCompleted() {
        if (!this.lastCompletedCommissionName) return false;

        const staleCommission = this.commissions.find((commission) => commission.name === this.lastCompletedCommissionName && commission.progress > 0);
        if (staleCommission?.progress === 1) return true;

        this.lastCompletedCommissionName = null;
        return false;
    }

    updateCommissionsIfChanged(newCommissions) {
        if (this.commissionsEqual(this.commissions, newCommissions)) return;

        const now = Date.now();
        if (this.ignoreTabUpdatesUntil && now < this.ignoreTabUpdatesUntil && this.lastCommissionSyncSource === 'GUI') {
            return;
        }

        if (this.ignoreTabUpdatesUntil && now < this.ignoreTabUpdatesUntil && this.lastCompletedCommissionName) {
            const staleCompleted = newCommissions.find((commission) => commission.name === this.lastCompletedCommissionName && commission.progress === 1);
            if (staleCompleted) return;
            this.ignoreTabUpdatesUntil = 0;
        } else if (this.ignoreTabUpdatesUntil && now >= this.ignoreTabUpdatesUntil) {
            this.ignoreTabUpdatesUntil = 0;
        }

        this.commissions = newCommissions;
        this.lastCommissionSyncSource = 'TAB';

        if (!this.awaitingTabUpdate) return;

        const stillCompleted = this.commissions.some((commission) => commission.progress === 1 && this.isSupportedCommissionName(commission.name));
        if (!stillCompleted) {
            this.awaitingTabUpdate = false;
            return;
        }

        if (!this.lastCompletedCommissionName) return;

        const sameNameCommission = this.commissions.find((commission) => commission.name === this.lastCompletedCommissionName);
        if (!sameNameCommission || sameNameCommission.progress < 1) {
            this.awaitingTabUpdate = false;
        }
    }

    commissionsEqual(a, b) {
        if (a === b) return true;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        return a.length === b.length && a.every((left, i) => left?.name === b[i]?.name && left?.progress === b[i]?.progress);
    }

    sameStringArrays(left, right) {
        if (left === right) return true;
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        return left.length === right.length && left.every((value, i) => value === right[i]);
    }

    notifyNoSupportedCommissions() {
        const now = Date.now();
        if (now - this.noSupportedMessageAt < 5000) return;

        this.noSupportedMessageAt = now;
        this.message('&eNo supported Glacite mining commissions detected.');
    }

    getOreDisplay() {
        if (!this.activeOreTypes.length) return 'None';
        return this.activeOreTypes.map((ore) => `${ore.charAt(0).toUpperCase()}${ore.slice(1)}`).join(', ');
    }

    getCompletedCommissions() {
        return OverlayManager.getTrackedValue(this.oid, 'commissionsCompleted', 0);
    }

    getCommissionsPerHourDisplay() {
        const elapsedMs = MacroState.getModuleElapsedMs(this.name);
        if (elapsedMs <= 0) return '0.00';

        const hours = elapsedMs / 3600000;
        const rate = this.getCompletedCommissions() / hours;
        if (!Number.isFinite(rate)) return '0.00';

        return rate.toFixed(2);
    }

    delay(ticks) {
        this.pauseTicks = Math.max(0, Math.floor(finiteNumber(ticks)));
    }

    setState(newState) {
        if (this.currentState !== newState) this.currentState = newState;
    }
}

if (isDeveloperModeEnabled()) new GlaciteCommissionMacro();
