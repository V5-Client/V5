import { OverlayManager } from '../../gui/OverlayUtils';
import { notificationManager } from '../../gui/NotificationManager';
import { Chat } from '../../utils/Chat';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { manager } from '../../utils/SkyblockEvents';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { CombatBot } from '../combat/CombatBot';
import { COMMISSION_DATA, EMISSARY_LOCATIONS, MOB_CONFIGS, TRASH_ITEMS } from './CommissionData';
import { MiningBot } from './MiningBot';

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    TRAVELING: 'Traveling to Location',
    WAITING_GUI_CLOSE: 'Closing GUI',
    MINING: 'Mining',
    SLAYER: 'Killing Mobs',
    SELLING: 'Selling Items',
    REFUELING: 'Refueling Drill',
    CLAIMING: 'Claiming Rewards',
    SWAPPING_PICK: 'Swapping Pickonimbus',
};

class CommissionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Commission Macro',
            subcategory: 'Mining',
            description: 'Completes Commissions for you',
            tooltip: 'Completes Commissions for you (Dwarven).',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
            isMacro: true,
        });
        this.bindToggleKey();
        this.setTheme('#4cdfd2');

        this.currentState = STATES.IDLE;
        this.avoidanceRadius = 10;
        this.goblinWeaponSlot = 1;
        this.emissariesUnlocked = true;
        this.pauseTicks = 0;
        this.pathingAvoidanceBreachAt = null;
        this.lastAvoidanceRepathAt = 0;
        this.currentPathWaypoint = null;
        this.currentPathWaypoints = [];

        this.commissions = [];
        this.currentCommission = null;
        this.currentMobConfig = null;
        this.mobWhitelist = new Set();
        this.savedState = null;
        this.awaitingTabUpdate = false;
        this.ignoreTabUpdatesUntil = 0;
        this.lastCommissionSyncSource = null;
        this.travelPurpose = null;

        this.drill = null;
        this.blueCheese = null;
        this.pickaxe = null;
        this.weapon = null;
        this.isActualDrill = false;
        this.miningSpeed = 0;
        this.lastCompletedCommissionName = null;
        this.lastCommissionName = null;
        this.lastCommissionAt = null;
        this.npcRotationPending = false;
        this.npcRotationToken = 0;

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        State: () => this.currentState,
                        Commission: () => this.currentCommission?.name || 'None',
                        Progress: () => this.getCommissionProgressDisplay(),
                        Tool: () => this.getTruncatedToolName(),
                    },
                },
                {
                    title: 'Profits',
                    data: {
                        'Completed Commissions': () => this.getCompletedCommissions(),
                        'Last Commission': () => this.getLastCommissionDisplay(),
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
                OverlayManager.incrementTrackedValue(this.oid, 'commissionsCompleted');
                this.onCommissionComplete();
            }
        });

        manager.subscribe('fullinventory', () => {
            if (this.enabled && this.currentState === STATES.MINING) this.onInventoryFull();
        });

        manager.subscribe('emptydrill', () => {
            if (this.enabled && this.currentState === STATES.MINING) this.onDrillEmpty();
        });

        manager.subscribe('death', () => {
            if (this.enabled) this.delayedReset(10);
        });

        manager.subscribe('serverchange', () => {
            if (this.enabled) this.delayedReset(67);
        });

        this.on('worldUnload', () => {
            this.delayedReset(67);
        });

        this.addSlider(
            'Avoidance Radius',
            0,
            30,
            10,
            (value) => {
                this.avoidanceRadius = value;
            },
            'How close players/Star Sentries can be to a mining spot before it is considered occupied.'
        );

        this.addSlider(
            'Weapon Slot (Goblin)',
            1,
            8,
            1,
            (value) => {
                this.goblinWeaponSlot = value;
            },
            'Hotbar slot with weapon for Goblin Slayer (1-8)'
        );
    }

    getCommissionProgressDisplay() {
        const currentCommName = this.currentCommission?.name || 'None';
        const currentCommData = this.commissions.find((c) => c.name === currentCommName);
        const currentProgress = currentCommData?.progress || 0;
        return currentProgress === 1 ? 'DONE' : `${(currentProgress * 100).toFixed(0)}%`;
    }

    getLastCommissionDisplay() {
        return this.lastCommissionName || 'None';
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

    getTruncatedToolName() {
        const toolInfo = this.getToolDisplay();
        const maxLen = 45;
        let name = toolInfo.name;
        if (name.length > maxLen) {
            name = name.substring(0, maxLen - 2) + '..';
        }
        return `${name}`;
    }

    getToolDisplay() {
        if (this.isGoblinSlayerWithWeapon()) {
            return {
                type: 'Weapon',
                name: this.weapon.name,
            };
        }

        if (this.drill) {
            const fullName = ChatLib.removeFormatting(this.drill.item.getName());
            if (this.isActualDrill) {
                return {
                    type: 'Drill',
                    name: fullName,
                };
            }
            return {
                type: 'Pickaxe',
                name: fullName,
            };
        }

        return {
            type: 'None',
            name: 'None',
        };
    }

    isGoblinSlayerWithWeapon() {
        return this.currentState === STATES.SLAYER && this.currentCommission?.name === 'Goblin Slayer' && this.weapon;
    }

    onEnable() {
        this.message('&aEnabled');
        this.emissariesUnlocked = true;

        const drills = MiningUtils.getDrills();
        this.drill = drills.drill;
        this.pickaxe = this.drill;
        this.blueCheese = drills.blueCheese;

        if (!this.drill) {
            Chat.message('&cNo drill or pickaxe found in hotbar!');
            this.toggle(false);
            return;
        }

        const itemName = ChatLib.removeFormatting(this.drill.item.getName());
        this.isActualDrill = itemName.includes('Drill') || itemName.includes('Gauntlet');

        this.weapon = this.getWeaponFromSlot();
        if (!this.weapon) {
            notificationManager.add(`No weapon found in slot ${this.goblinWeaponSlot}`, 'Goblin commissions will be skipped.', 'ERROR', '5000');
        }

        this.miningSpeed = MiningUtils.getMiningSpeed('Dwarven Mines');
        if (!this.miningSpeed) {
            notificationManager.add('No mining speed saved!', "Run '/v5 mining stats' first.", 'ERROR', '5000');
            this.toggle(false);
            return;
        }

        Mouse.ungrab();
        this.resetState();
    }

    onDisable() {
        this.message('&cDisabled');
        this.resetState();

        Mouse.regrab();
    }

    resetState() {
        this.currentState = STATES.IDLE;
        this.commissions = [];
        this.currentCommission = null;
        this.currentMobConfig = null;
        this.mobWhitelist.clear();
        this.savedState = null;
        this.travelPurpose = null;
        this.pauseTicks = 0;
        this.awaitingTabUpdate = false;
        this.ignoreTabUpdatesUntil = 0;
        this.lastCommissionSyncSource = null;
        this.lastCompletedCommissionName = null;
        this.lastCommissionName = null;
        this.lastCommissionAt = null;
        this.npcRotationPending = false;
        this.npcRotationToken = 0;
        this.areaCheckTime = null;
        this.pathingAvoidanceBreachAt = null;
        this.lastAvoidanceRepathAt = 0;
        this.currentPathWaypoint = null;
        this.currentPathWaypoints = [];

        MiningBot.toggle(false, true);
        CombatBot.clearExternalTargets();
        CombatBot.toggle(false);
        Pathfinder.resetPath(true);
        Keybind.setKey('rightclick', false);
    }

    delayedReset(delay) {
        this.resetState();
        this.delay(delay);
    }

    setState(newState) {
        if (this.currentState !== newState) {
            this.currentState = newState;
        }
    }

    runLogic() {
        if (!this.enabled) return;
        this.cancelNpcRotationIfPathing();
        this.handlePathingAvoidance();

        if (this.pauseTicks > 0) {
            this.pauseTicks--;
            return;
        }

        switch (this.currentState) {
            case STATES.IDLE:
                this.handleIdle();
                break;
            case STATES.CHOOSING:
                this.handleChoosing();
                break;
            case STATES.WAITING_GUI_CLOSE:
                this.handleWaitingGuiClose();
                break;
            case STATES.SLAYER:
                this.handleSlayer();
                break;
            case STATES.SELLING:
                this.handleSelling();
                break;
            case STATES.CLAIMING:
                this.handleClaiming();
                break;
            default:
                break;
        }
    }

    handleIdle() {
        this.setState(STATES.CHOOSING);
    }

    handleChoosing() {
        const area = Utils.area();
        const now = Date.now();
        if (area !== 'Dwarven Mines') {
            if (!this.areaCheckTime) {
                Chat.message('&eNot in Dwarven Mines, warping...');
                ChatLib.command('warpforge');
                this.areaCheckTime = now;
                return;
            }
            if (now - this.areaCheckTime > 10000) {
                ChatLib.command('warpforge');
                this.areaCheckTime = now;
            }
            return;
        }
        this.areaCheckTime = null;

        const newCommissions = MiningUtils.readCommissions();
        this.updateCommissionsIfChanged(newCommissions);

        if (this.shouldWaitForLastCompleted()) return;
        if (this.awaitingTabUpdate) return;

        const completedCommission = this.findCompletedCommission();
        if (completedCommission) {
            if (
                this.lastCompletedCommissionName &&
                completedCommission.name === this.lastCompletedCommissionName &&
                this.ignoreTabUpdatesUntil &&
                now < this.ignoreTabUpdatesUntil
            ) {
                this.awaitingTabUpdate = true;
                return;
            }
            this.currentCommission = completedCommission;
            this.onCommissionComplete();
            return;
        }

        const activeCommissions = this.getActiveCommissions();
        if (activeCommissions.length === 0) {
            Chat.message('No commissions detected.');
            Chat.message('Ensure commissions are enabled in /tab');
            Chat.message('You might have to speak to the king first.');
            this.toggle(false);
            return;
        }

        const supportedTasks = this.getSupportedTasks(activeCommissions);
        if (supportedTasks.length === 0) {
            Chat.message('&eNo supported commissions available.');
            this.toggle(false);
            return;
        }

        const avoidEntities = this.getAvoidanceEntities();
        const chosenCommission = this.findAvailableCommission(supportedTasks, avoidEntities);

        if (chosenCommission) {
            this.startCommission(chosenCommission);
        } else {
            this.handleNoAvailableSpots();
        }
    }

    shouldWaitForLastCompleted() {
        if (!this.lastCompletedCommissionName) return false;
        const staleCommission = this.commissions.find((c) => c.name === this.lastCompletedCommissionName && c.progress > 0);
        if (staleCommission && staleCommission.progress === 1) return true;
        if (staleCommission && staleCommission.progress < 1) {
            this.lastCompletedCommissionName = null;
            return false;
        }
        this.lastCompletedCommissionName = null;
        return false;
    }

    findCompletedCommission() {
        return this.commissions.find((c) => {
            if (c.progress !== 1) return false;
            return COMMISSION_DATA.some((d) => d.names.includes(c.name));
        });
    }

    getActiveCommissions() {
        return this.commissions.filter((c) => c.progress < 1);
    }

    getSupportedTasks(activeCommissions) {
        return activeCommissions
            .map((tabComm) => this.mergeCommissionData(tabComm))
            .filter((task) => this.isSupportedTask(task))
            .sort((a, b) => a.cost - b.cost);
    }

    mergeCommissionData(tabComm) {
        const data = COMMISSION_DATA.find((d) => d.names.includes(tabComm.name));
        if (!data) return null;

        const merged = { ...tabComm, ...data };

        if (data.useAllMiningWaypoints) {
            merged.waypoints = COMMISSION_DATA.filter((d) => d.type === 'MINING' && !d.useAllMiningWaypoints)
                .map((d) => d.waypoints)
                .reduce((acc, waypoints) => acc.concat(waypoints), []);
        }

        return merged;
    }

    isSupportedTask(task) {
        if (!task) return false;

        if (task.type === 'MINING') {
            if (task.name.includes('Goblin') && !this.weapon) return false;
            return true;
        }

        if (task.type === 'SLAYER') {
            if (task.name === 'Goblin Slayer' && !this.weapon) return false;
            return true;
        }

        return false; // unreachable
    }

    getAvoidanceEntities() {
        if (this.avoidanceRadius <= 0) return [];
        return World.getAllPlayers().filter((entity) => {
            if (entity.getUUID().equals(Player.getUUID())) return false;

            const isPlayer = entity.getUUID().version() === 4;
            const isCrystalSentry = entity.getName().includes('Crystal Sentry');
            return isPlayer || isCrystalSentry;
        });
    }

    findAvailableCommission(supportedTasks, avoidEntities) {
        for (const task of supportedTasks) {
            const safeWaypoints = this.getSafeWaypoints(task, avoidEntities);
            if (safeWaypoints.length > 0) return { task, waypoints: safeWaypoints };
        }
        return null;
    }

    getSafeWaypoints(task, avoidEntities) {
        if (this.avoidanceRadius <= 0) return task.waypoints;
        return task.waypoints.filter((waypoint) => {
            return !avoidEntities.some((entity) => {
                const distance = this.getDistance(entity.getX(), entity.getY(), entity.getZ(), ...waypoint);
                return distance < this.avoidanceRadius;
            });
        });
    }

    getClosestWaypoint(waypoints) {
        const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        return waypoints.reduce((closest, current) => {
            const closestDist = this.getDistance(playerPos.x, playerPos.y, playerPos.z, ...closest);
            const currentDist = this.getDistance(playerPos.x, playerPos.y, playerPos.z, ...current);
            return currentDist < closestDist ? current : closest;
        });
    }

    startCommission(chosenCommission) {
        const { task, waypoints } = chosenCommission;
        this.currentCommission = task;
        this.travelPurpose = task.type;
        this.pathingAvoidanceBreachAt = null;

        Chat.message(`Starting &e${task.name}&f commission.`);

        this.currentPathWaypoints = waypoints.slice();
        this.currentPathWaypoint = this.getClosestWaypoint(waypoints);
        this.setState(STATES.TRAVELING);
        Pathfinder.findPath(waypoints, (success) => this.onPathComplete(success));
    }

    handleNoAvailableSpots() {
        Chat.message('No available spots! Finding new lobby');
        ChatLib.command('hub');
        this.resetState();
        this.delay(80);
    }

    handleSlayer() {
        if (!this.currentMobConfig) {
            CombatBot.clearExternalTargets();
            CombatBot.toggle(false, true);
            return;
        }

        const mobs = CombatBot.findMob(this.currentMobConfig, this.mobWhitelist);
        if (!mobs || mobs.length === 0) {
            CombatBot.setExternalTargets([]);
            return;
        }

        CombatBot.setExternalTargets(mobs);
        if (!CombatBot.enabled) {
            CombatBot.toggle(true, true);
        }
    }

    handleSelling() {
        // COMPLETELY UNTESTED :)
        if (Guis.guiName() !== 'Trades') {
            ChatLib.command('trades');
            this.delay(10);
            return;
        }

        const soldItem = this.sellNextTrashItem();
        if (soldItem) return;

        // No more items to sell
        Guis.closeInv();
        this.restoreStateAfterSelling();
    }

    sellNextTrashItem() {
        const container = Player.getContainer();
        if (!container) return false;

        const items = container.getItems();
        if (!items || items.length <= 54) return false;

        for (let i = 54; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            const name = ChatLib.removeFormatting(item.getName());
            const isTrash = TRASH_ITEMS.some((trash) => name.includes(trash));
            const isNotEquipment = !name.includes('Drill') && !name.includes('Pickaxe') && !name.includes('Minecart');

            if (isTrash && isNotEquipment) {
                Guis.clickSlot(i, false);
                return true;
            }
        }
        return false;
    }

    restoreStateAfterSelling() {
        if (this.savedState) {
            this.setState(this.savedState);
            if (this.savedState === STATES.MINING) this.startMining();
            this.savedState = null;
        } else {
            this.setState(STATES.CHOOSING);
        }
    }

    handleClaiming() {
        this.cancelNpcRotationIfPathing();
        const emissaryLocations = this.getAvailableEmissaryLocations();

        if (Guis.guiName() === 'Commissions') {
            this.claimCompletedCommissions();
            return;
        }

        const pigeonSlot = Guis.findItemInHotbar('Royal Pigeon');
        if (pigeonSlot !== -1) {
            if (Player.getHeldItemIndex() != pigeonSlot) {
                Guis.setItemSlot(pigeonSlot);
                this.delay(3);
            } else {
                Keybind.rightClick();
                this.delay(10);
            }
            return;
        }

        const closest = this.getClosestEmissary();
        const closestDist = this.getDistance(Player.getX(), Player.getY(), Player.getZ(), ...closest);

        const yDiff = closest[1] - Player.getY();
        if (yDiff > 3 && closestDist < 10) {
            if (!Pathfinder.isPathing()) {
                // console.log('under platform');
                this.travelPurpose = 'EMISSARY';

                Pathfinder.findPath(emissaryLocations, (success) => {
                    if (!success) {
                        Chat.message('&cFailed to get to emissary ╭( ๐_๐)╮');
                        // probably should blacklist emissary and go to different emissary
                        this.setState(STATES.CHOOSING);
                    }
                });
            }
            return;
        }

        if (closestDist < 4 && !Pathfinder.isPathing()) {
            if (!this.ensureDrillEquippedForEmissaryClaim()) return;

            const adjustedTarget = [closest[0] + 0.5, closest[1] + 2.2, closest[2] + 0.5];
            if (!this.npcRotationPending && !Rotations.isRotating && !Pathfinder.isPathing()) {
                this.npcRotationPending = true;
                const token = ++this.npcRotationToken;
                Rotations.rotateToVector(adjustedTarget);
                Rotations.onEndRotation(() => {
                    if (Pathfinder.isPathing()) return;
                    if (!this.npcRotationPending || this.npcRotationToken !== token) return;
                    this.npcRotationPending = false;
                    if (this.emissariesUnlocked && !this.checkEmissaryUnlocked()) return;
                    Keybind.rightClick();
                    this.delay(10);
                });
            }
            return;
        }

        if (Pathfinder.isPathing()) return;
        this.travelPurpose = 'EMISSARY';
        Pathfinder.findPath(emissaryLocations, (success) => {
            if (!success) {
                this.setState(STATES.CHOOSING);
            }
        });
    }

    ensureDrillEquippedForEmissaryClaim() {
        if (!this.drill) {
            const drills = MiningUtils.getDrills();
            this.drill = drills.drill;
            this.pickaxe = this.drill;
        }

        if (!this.drill) return true;

        if (Player.getHeldItemIndex() !== this.drill.slot) {
            Guis.setItemSlot(this.drill.slot);
            this.delay(3);
            return false;
        }

        return true;
    }

    getClosestEmissary() {
        const emissaryLocations = this.getAvailableEmissaryLocations();
        const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
        let closest = emissaryLocations[0];
        let closestDist = this.getDistance(...playerPos, ...closest);
        for (let i = 1; i < emissaryLocations.length; i++) {
            const current = emissaryLocations[i];
            const currentDist = this.getDistance(...playerPos, ...current);
            if (currentDist < closestDist) {
                closest = current;
                closestDist = currentDist;
            }
        }
        return closest;
    }

    getAvailableEmissaryLocations() {
        if (!this.emissariesUnlocked) {
            return [EMISSARY_LOCATIONS[0]];
        }
        return EMISSARY_LOCATIONS;
    }

    checkEmissaryUnlocked() {
        if (!World.getAllEntities().find((e) => e.getName().includes('Emissary'))) {
            this.emissariesUnlocked = false;
            Chat.message('Emissary not found! Reverting to king.');
            return false;
        }
        return true;
    }

    claimCompletedCommissions() {
        const Commissions = Player.getContainer();
        if (!Commissions) return;

        let foundCompleted = false;

        for (let i = 9; i < 17; i++) {
            const stack = Commissions.getStackInSlot(i);
            if (!stack) continue;

            const hasCompleted = stack.getLore().some((line) => line.toString().includes('COMPLETED'));
            if (hasCompleted) {
                Guis.clickSlot(i, false);
                this.delay(10);
                foundCompleted = true;
                return;
            }
        }

        if (!foundCompleted) {
            this.updateCommissionsFromGui(Commissions);
            Guis.closeInv();
            this.setState(STATES.WAITING_GUI_CLOSE);
        }
    }

    updateCommissionsFromGui(container) {
        const newCommissions = MiningUtils.readCommissionsFromGui(container, (name) => COMMISSION_DATA.some((d) => d.names.includes(name)));

        if (newCommissions.length > 0) {
            this.commissions = newCommissions;
            this.awaitingTabUpdate = false;
            this.lastCommissionSyncSource = 'GUI';
            this.ignoreTabUpdatesUntil = Date.now() + 5000;

            const currentName = this.currentCommission?.name;
            const matching = currentName ? this.commissions.find((c) => c.name === currentName) : null;
            if (!matching || matching.progress === 1) {
                this.currentCommission = null;
            }
        }
    }

    handleWaitingGuiClose() {
        if (Client.isInGui()) {
            return;
        }

        this.refreshDrillReference();
        this.setState(STATES.CHOOSING);
    }

    refreshDrillReference() {
        const drills = MiningUtils.getDrills();
        this.drill = drills.drill;
        this.pickaxe = this.drill;

        if (this.drill) {
            const itemName = ChatLib.removeFormatting(this.drill.item.getName());
            this.isActualDrill = itemName.includes('Drill') || itemName.includes('Gauntlet');
            Guis.setItemSlot(this.drill.slot);
        }
    }

    delay(ticks) {
        this.pauseTicks = Math.max(0, Math.floor(Number(ticks) || 0));
    }

    cancelNpcRotationIfPathing() {
        if (!Pathfinder.isPathing()) return;
        if (!this.npcRotationPending) return;

        this.npcRotationPending = false;
        this.npcRotationToken++;
        if (Rotations.isRotating) {
            Rotations.stopRotation();
        }
    }

    isTravelMiningPathing() {
        return this.currentState === STATES.TRAVELING && this.currentCommission?.type === 'MINING' && Pathfinder.isPathing();
    }

    handlePathingAvoidance() {
        if (!this.isTravelMiningPathing() || this.avoidanceRadius <= 0) {
            this.pathingAvoidanceBreachAt = null;
            return;
        }

        this.updateCurrentPathWaypointFromResult();
        if (!this.currentPathWaypoint) {
            this.pathingAvoidanceBreachAt = null;
            return;
        }

        const avoidEntities = this.getAvoidanceEntities();
        const isBreached = avoidEntities.some((entity) => {
            const distance = this.getDistance(entity.getX(), entity.getY(), entity.getZ(), ...this.currentPathWaypoint);
            return distance < this.avoidanceRadius;
        });

        if (!isBreached) {
            this.pathingAvoidanceBreachAt = null;
            return;
        }

        const now = Date.now();
        if (!this.pathingAvoidanceBreachAt) {
            this.pathingAvoidanceBreachAt = now;
            return;
        }

        if (now - this.pathingAvoidanceBreachAt < 5000) return;
        if (now - this.lastAvoidanceRepathAt < 2000) return;

        const safeWaypoints = this.getSafeWaypoints(this.currentCommission, avoidEntities).filter(
            (waypoint) => !this.isSameWaypoint(waypoint, this.currentPathWaypoint)
        );
        if (safeWaypoints.length === 0) return;

        this.currentPathWaypoints = safeWaypoints;
        this.currentPathWaypoint = this.getClosestWaypoint(safeWaypoints);
        this.pathingAvoidanceBreachAt = null;
        this.lastAvoidanceRepathAt = now;

        Chat.message('&eAvoidance radius breached for 5s, repathing to a different vein...');
        Pathfinder.resetPath();
        Pathfinder.findPath(safeWaypoints, (success) => this.onPathComplete(success));
    }

    isSameWaypoint(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    }

    getDistance(x1, y1, z1, x2, y2, z2) {
        return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    }

    updateCurrentPathWaypointFromResult() {
        if (!this.currentPathWaypoints || this.currentPathWaypoints.length === 0) return;

        const result = Pathfinder.getResult();
        const path = result?.path;
        if (!path || path.length === 0) return;

        const pathEnd = path[path.length - 1];
        if (!pathEnd) return;

        let bestWaypoint = this.currentPathWaypoints[0];
        let bestDistanceSq = Number.MAX_VALUE;

        this.currentPathWaypoints.forEach((waypoint) => {
            const dx = pathEnd.x - waypoint[0];
            const dy = pathEnd.y - (waypoint[1] + 1);
            const dz = pathEnd.z - waypoint[2];
            const distanceSq = dx * dx + dy * dy + dz * dz;
            if (distanceSq < bestDistanceSq) {
                bestDistanceSq = distanceSq;
                bestWaypoint = waypoint;
            }
        });

        this.currentPathWaypoint = bestWaypoint;
    }

    onPathComplete(success) {
        if (!this.enabled) return;
        if (!success) {
            this.onPathFail();
            return;
        }

        this.pathingAvoidanceBreachAt = null;
        this.currentPathWaypoint = null;
        this.currentPathWaypoints = [];

        if (this.travelPurpose === 'EMISSARY') {
            this.travelPurpose = null;
            this.setState(STATES.CLAIMING);
            return;
        }

        const type = this.currentCommission?.type;
        if (type === 'MINING') {
            this.setState(STATES.MINING);
            this.startMining();
        } else if (type === 'SLAYER') {
            this.setState(STATES.SLAYER);
            this.startSlayer();
        } else {
            this.setState(STATES.IDLE);
        }

        this.travelPurpose = null;
    }

    onPathFail() {
        if (!this.enabled) return;
        Chat.message(`&cFailed to find a path for &b${this.currentCommission?.name || 'Unknown'}. Retrying...`);
        this.pathingAvoidanceBreachAt = null;
        this.currentPathWaypoint = null;
        this.currentPathWaypoints = [];
        this.currentCommission = null;
        this.setState(STATES.IDLE);
    }

    startMining() {
        if (Client.isInGui()) {
            Chat.message('&eWaiting for GUI to close before mining...');
            this.setState(STATES.WAITING_GUI_CLOSE);
            return;
        }

        const drills = MiningUtils.getDrills();
        this.drill = drills.drill;

        if (!this.drill) {
            notificationManager.add('No drill or pickaxe found!', 'What happened?', 'ERROR', '5000');
            this.toggle(false);
            return;
        }

        const itemName = ChatLib.removeFormatting(this.drill.item.getName());
        this.isActualDrill = itemName.includes('Drill') || itemName.includes('Gauntlet');

        Guis.setItemSlot(this.drill.slot);

        const isTitaniumCommission = this.currentCommission.name.includes('Titanium');
        MiningBot.setPrioritizeTitanium(isTitaniumCommission);
        MiningBot.setPrioritizeGrayMithril(true);

        MiningBot.setCost(MiningBot.mithrilCosts);
        MiningBot.toggle(true, true);
    }

    startSlayer() {
        const name = this.currentCommission.name;
        let mobType;

        if (name === 'Goblin Slayer') {
            mobType = 'goblin';
            Guis.setItemSlot(this.weapon.slot);
        } else if (name === 'Glacite Walker Slayer' || name === 'Mines Slayer' || name === 'Treasure Hoarder Puncher') {
            mobType = name === 'Glacite Walker Slayer' || name === 'Mines Slayer' ? 'icewalker' : 'treasure';
            Guis.setItemSlot(this.pickaxe.slot);
        } else {
            this.toggle(false);
            return;
        }

        this.currentMobConfig = MOB_CONFIGS[mobType];
        if (!this.currentMobConfig) {
            this.toggle(false);
            return;
        }

        CombatBot.setExternalTargets([]);
        if (!CombatBot.enabled) {
            CombatBot.toggle(true, true);
        }
    }

    onCommissionComplete() {
        Pathfinder.resetPath();
        MiningBot.toggle(false, true);

        CombatBot.clearExternalTargets();
        CombatBot.toggle(false, true);

        this.travelPurpose = null;
        this.currentPathWaypoint = null;
        this.currentPathWaypoints = [];
        this.lastCompletedCommissionName = this.currentCommission?.name || null;
        this.lastCommissionName = this.currentCommission?.name || null;
        this.lastCommissionAt = Date.now();
        this.awaitingTabUpdate = true;
        this.setState(STATES.CLAIMING);
    }

    onInventoryFull() {
        Chat.message('&eInventory full! Selling items...');
        MiningBot.toggle(false, true);
        this.savedState = this.currentState;
        this.setState(STATES.SELLING);
    }

    onDrillEmpty() {
        if (!this.isActualDrill) {
            return;
        }

        Chat.message('&eDrill empty! Refueling...');
        MiningBot.toggle(false, true);
        this.setState(STATES.REFUELING);

        MiningUtils.doRefueling(true, (success) => {
            if (!success) {
                Chat.message('&cRefueling failed!');
                this.toggle(false);
                return;
            }

            Chat.message('&aRefueling successful!');
            const drills = MiningUtils.getDrills();
            this.drill = drills.drill;
            this.blueCheese = drills.blueCheese; // unused rn

            if (this.drill) {
                const itemName = ChatLib.removeFormatting(this.drill.item.getName());
                this.isActualDrill = itemName.includes('Drill') || itemName.includes('Gauntlet');
            }

            this.setState(STATES.IDLE);
        });
    }

    getWeaponFromSlot() {
        const slot = this.goblinWeaponSlot - 1;
        const item = Player.getInventory().getStackInSlot(slot);
        if (!item) return null;

        const name = ChatLib.removeFormatting(item.getName());
        if (name.includes('Mithril') || name.includes('Titanium') || name === '') return null;

        return { slot, name };
    }

    getClosestMob(mobs) {
        return mobs.reduce((closest, current) => {
            const closestDist = this.getDistance(Player.getX(), Player.getY(), Player.getZ(), closest.getX(), closest.getY(), closest.getZ());
            const currentDist = this.getDistance(Player.getX(), Player.getY(), Player.getZ(), current.getX(), current.getY(), current.getZ());
            return currentDist < closestDist ? current : closest;
        }, mobs[0]);
    }

    commissionsEqual(a, b) {
        if (a === b) return true;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            const left = a[i];
            const right = b[i];
            if (!left || !right) return false;
            if (left.name !== right.name || left.progress !== right.progress) return false;
        }

        return true;
    }

    updateCommissionsIfChanged(newCommissions) {
        if (this.commissionsEqual(this.commissions, newCommissions)) return;

        const now = Date.now();
        if (this.ignoreTabUpdatesUntil && now < this.ignoreTabUpdatesUntil && this.lastCommissionSyncSource === 'GUI') {
            return;
        }

        if (this.ignoreTabUpdatesUntil && now < this.ignoreTabUpdatesUntil && this.lastCompletedCommissionName) {
            const staleCompleted = newCommissions.find((c) => c.name === this.lastCompletedCommissionName && c.progress === 1);
            if (staleCompleted) return;
            this.ignoreTabUpdatesUntil = 0;
        } else if (this.ignoreTabUpdatesUntil && now >= this.ignoreTabUpdatesUntil) {
            this.ignoreTabUpdatesUntil = 0;
        }

        this.commissions = newCommissions;
        this.lastCommissionSyncSource = 'TAB';

        if (this.awaitingTabUpdate) {
            const stillCompleted = this.commissions.some((c) => {
                if (c.progress !== 1) return false;
                return COMMISSION_DATA.some((d) => d.names.includes(c.name));
            });

            if (!stillCompleted) {
                this.awaitingTabUpdate = false;
            } else if (this.lastCompletedCommissionName) {
                const sameNameComm = this.commissions.find((c) => c.name === this.lastCompletedCommissionName);
                if (!sameNameComm || sameNameComm.progress < 1) {
                    this.awaitingTabUpdate = false;
                }
            }
        }
    }
}

new CommissionMacro();
