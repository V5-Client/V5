//@VIP
import { OverlayManager } from '../../gui/OverlayUtils';
import { Chat } from '../../utils/Chat';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { manager } from '../../utils/SkyblockEvents';
import { Mouse } from '../../utils/Ungrab';
import { MiningBot } from './MiningBot';
import { tunnelsMiner } from './TunnelsMiner';

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    MINING: 'Mining',
    CLAIMING: 'Claiming Rewards',
    WAITING_GUI_CLOSE: 'Closing GUI',
};

const SUPPORTED_ORES = ['glacite', 'umber', 'tungsten', 'peridot', 'aquamarine', 'onyx', 'citrine'];
const EMISSARY_LOCATION = [2, 121, 237];

class GlaciteCommissionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Glacite Commission Macro',
            subcategory: 'Mining',
            description: 'Completes Glacite mining commissions with Tunnels Miner',
            tooltip: 'Reads Glacite commissions from tab, mines required tunnel ores, and claims with pigeon or emissary.',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
            isMacro: true,
        });

        this.bindToggleKey();
        this.setTheme('#88d7ff');

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
        this.pigeonAttempts = 0;
        this.firstPigeonAttemptAt = 0;
        this.npcRotationPending = false;
        this.npcRotationToken = 0;
        this.drill = null;

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
            const newCommissions = MiningUtils.readCommissions();
            this.updateCommissionsIfChanged(newCommissions);
        }).setDelay(1);

        this.on('tick', () => this.runLogic());

        this.on('chat', (event) => {
            const msg = event.message.getUnformattedText();
            if (msg?.includes('Commission Complete! Visit the King to claim')) {
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
            Chat.message('&cNo drill or pickaxe found in hotbar!');
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
        this.resetClaimState();
        this.cancelNpcRotation();
        this.stopTunnelMiner();
        Pathfinder.resetPath(true);
        Keybind.setKey('rightclick', false);
    }

    delayedReset(delay) {
        this.resetState();
        this.delay(delay);
    }

    resetClaimState() {
        this.pigeonAttempts = 0;
        this.firstPigeonAttemptAt = 0;
    }

    runLogic() {
        if (!this.enabled) return;

        this.cancelNpcRotationIfPathing();

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
        const newCommissions = MiningUtils.readCommissions();
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
        const newCommissions = MiningUtils.readCommissions();
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
        if (!Pathfinder.isPathing() && !MiningBot.enabled && now - this.lastTunnelRestartAt >= 5000) {
            tunnelsMiner.restart();
            this.lastTunnelRestartAt = now;
        }
    }

    handleClaiming() {
        this.cancelNpcRotationIfPathing();

        if (Guis.guiName() === 'Commissions') {
            this.claimCompletedCommissions();
            return;
        }

        const now = Date.now();
        const pigeonSlot = Guis.findItemInHotbar('Royal Pigeon');
        const pigeonTimedOut = this.firstPigeonAttemptAt && now - this.firstPigeonAttemptAt > 4000;

        if (pigeonSlot !== -1 && this.pigeonAttempts < 3 && !pigeonTimedOut) {
            if (Player.getHeldItemIndex() !== pigeonSlot) {
                Guis.setItemSlot(pigeonSlot);
                this.delay(3);
            } else {
                if (!this.firstPigeonAttemptAt) this.firstPigeonAttemptAt = now;
                this.pigeonAttempts++;
                Keybind.rightClick();
                this.delay(10);
            }
            return;
        }

        if (Pathfinder.isPathing()) return;

        const closestDist = this.getDistance(Player.getX(), Player.getY(), Player.getZ(), ...EMISSARY_LOCATION);
        if (closestDist < 4) {
            if (!this.ensureDrillEquippedForClaim()) return;

            const adjustedTarget = [EMISSARY_LOCATION[0] + 0.5, EMISSARY_LOCATION[1] + 2.2, EMISSARY_LOCATION[2] + 0.5];
            if (!this.npcRotationPending && !Rotations.isRotating) {
                this.npcRotationPending = true;
                const token = ++this.npcRotationToken;
                Rotations.rotateToVector(adjustedTarget);
                Rotations.onEndRotation(() => {
                    if (Pathfinder.isPathing()) return;
                    if (!this.npcRotationPending || this.npcRotationToken !== token) return;
                    this.npcRotationPending = false;
                    Keybind.rightClick();
                    this.delay(10);
                });
            }
            return;
        }

        Pathfinder.findPath([EMISSARY_LOCATION], (success) => {
            if (!this.enabled || this.currentState !== STATES.CLAIMING) return;
            if (!success) {
                Chat.message('&cFailed to reach Glacite emissary.');
                this.setState(STATES.CHOOSING);
                this.delay(20);
            }
        });
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
        this.resetClaimState();

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
        OverlayManager.incrementTrackedValue(this.oid, 'commissionsCompleted');
        this.stopTunnelMiner();
        Pathfinder.resetPath();
        this.pendingMiningStart = false;
        this.awaitingTabUpdate = true;
        this.lastCompletedCommissionName = this.currentCommission?.name || null;
        this.resetClaimState();
        this.setState(STATES.CLAIMING);
    }

    claimCompletedCommissions() {
        const container = Player.getContainer();
        if (!container) return;

        for (let i = 9; i < 17; i++) {
            const stack = container.getStackInSlot(i);
            if (!stack) continue;

            const lore = stack.getLore() || [];
            const hasCompleted = lore.some((line) => String(line).includes('COMPLETED'));
            if (!hasCompleted) continue;

            Guis.clickSlot(i, false);
            this.delay(10);
            return;
        }

        this.updateCommissionsFromGui(container);
        Guis.closeInv();
        this.setState(STATES.WAITING_GUI_CLOSE);
    }

    updateCommissionsFromGui(container) {
        const newCommissions = MiningUtils.readCommissionsFromGui(container, (name) => this.isSupportedCommissionName(name));
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
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            if (a[i]?.name !== b[i]?.name || a[i]?.progress !== b[i]?.progress) return false;
        }

        return true;
    }

    sameStringArrays(left, right) {
        if (left === right) return true;
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        if (left.length !== right.length) return false;
        for (let i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) return false;
        }
        return true;
    }

    notifyNoSupportedCommissions() {
        const now = Date.now();
        if (now - this.noSupportedMessageAt < 5000) return;

        this.noSupportedMessageAt = now;
        Chat.message('&eNo supported Glacite mining commissions detected.');
    }

    cancelNpcRotationIfPathing() {
        if (!Pathfinder.isPathing()) return;
        this.cancelNpcRotation();
    }

    cancelNpcRotation() {
        if (!this.npcRotationPending && !Rotations.isRotating) return;

        this.npcRotationPending = false;
        this.npcRotationToken++;
        if (Rotations.isRotating) Rotations.stopRotation();
    }

    getOreDisplay() {
        if (!this.activeOreTypes.length) return 'None';
        return this.activeOreTypes.map((ore) => `${ore.charAt(0).toUpperCase()}${ore.slice(1)}`).join(', ');
    }

    getCompletedCommissions() {
        return OverlayManager.getTrackedValue(this.oid, 'commissionsCompleted', 0);
    }

    getCommissionsPerHourDisplay() {
        const elapsedMs = OverlayManager.getSessionElapsedMs(this.oid);
        if (elapsedMs <= 0) return '0.00';

        const hours = elapsedMs / 3600000;
        const rate = this.getCompletedCommissions() / hours;
        if (!Number.isFinite(rate)) return '0.00';

        return rate.toFixed(2);
    }

    getDistance(x1, y1, z1, x2, y2, z2) {
        return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    }

    delay(ticks) {
        this.pauseTicks = Math.max(0, Math.floor(Number(ticks) || 0));
    }

    setState(newState) {
        if (this.currentState !== newState) this.currentState = newState;
    }
}

new GlaciteCommissionMacro();
