import { Chat } from '../../utils/Chat';
import { findAndFollowPath, stopPathing } from '../../utils/pathfinder/PathAPI';
import { COMMISSION_DATA, EMISSARY_LOCATIONS, TRASH_ITEMS, MOB_CONFIGS } from './CommissionData';
import { manager } from '../../utils/SkyblockEvents';
import { MiningBot } from './MiningBot';
import { MacroState } from '../../utils/MacroState';
import { CombatBot } from '../combat/CombatBot';
import { MiningUtils } from '../../utils/MiningUtils';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { ModuleBase } from '../../utils/ModuleBase';
import { OverlayManager } from '../../gui/OverlayUtils';
// TODO
// ROTATION CALLBACKS FOR NPC CLICK
// SLAYER COMMISSIONS
// USE MULTIPLE END POINTS FOR EMISSARRY PATHFINDING

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    TRAVELING: 'Traveling to Location',
    WAITING: 'Waiting for Spot',
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
            tooltip: 'Completes Commissions for you (Dwarven). Use /startcommission and /stopcommission',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
        });

        this.overlayName = 'Commission Macro';
        this.commissionsCompleted = 0;
        this.currentToolType = 'None'; // 'Drill', 'Pickaxe', 'Weapon'
        this.currentToolName = 'None';
        this.initOverlay();

        this.bindToggleKey();
        this.currentState = STATES.IDLE;
        this.playerAvoidanceRadius = 10;
        this.goblinWeaponSlot = 1;
        this.swapPickaxeStep = 0;
        this.pauseTicks = 0;

        this.commissions = [];
        this.currentCommission = null;
        this.currentMobConfig = null;
        this.mobWhitelist = new Set();
        this.savedState = null;
        this.awaitingTabUpdate = false;
        this.travelPurpose = null;
        this.pathfinding = false;

        this.drill = null;
        this.blueCheese = null;
        this.pickaxe = null;
        this.weapon = null;
        this.isActualDrill = false;
        this.miningSpeed = 0;
        this.currentMiningWaypoint = null;
        this.lastCompletedCommissionName = null;

        this.on('step', () => {
            const newCommissions = MiningUtils.readCommissions();
            this.updateCommissionsIfChanged(newCommissions);
            if (this.enabled) {
                this.updateOverlay();
            }
        }).setDelay(1);
        this.on('tick', () => this.runLogic());

        this.on('chat', (event) => {
            const msg = event.message.getUnformattedText();
            if (msg?.includes('Commission Complete! Visit the King to claim')) {
                this.commissionsCompleted++;
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
            if (this.enabled) {
                Chat.message('&cYou died! Stopping macro...');
                this.toggle(false);
            }
        });

        this.addSlider(
            'Player Avoidance Radius',
            0,
            200,
            10,
            (value) => {
                this.playerAvoidanceRadius = value;
            },
            'How close another player can be to a mining spot before it is considered occupied.'
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

    initOverlay() {
        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: 'Idle',
                    Commission: 'None',
                    Progress: '0%',
                    Completed: '0',
                    Tool: 'None',
                },
            },
        ]);
    }

    getToolDisplay() {
        if (this.currentState === STATES.SLAYER && this.currentCommission?.name === 'Goblin Slayer' && this.weapon) {
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
            } else {
                return {
                    type: 'Pickaxe',
                    name: fullName,
                };
            }
        }

        return {
            type: 'None',
            name: 'None',
        };
    }

    updateOverlay() {
        const currentCommName = this.currentCommission?.name || 'None';
        const currentCommData = this.commissions.find((c) => c.name === currentCommName);
        const currentProgress = currentCommData?.progress || 0;
        const progressStr = currentProgress === 1 ? 'DONE' : `${(currentProgress * 100).toFixed(0)}%`;

        const toolInfo = this.getToolDisplay();
        const maxToolNameLen = 45;
        let toolDisplay = toolInfo.name;
        if (toolDisplay.length > maxToolNameLen) {
            toolDisplay = toolDisplay.substring(0, maxToolNameLen - 2) + '..';
        }

        OverlayManager.createID(this.overlayName, [
            {
                title: 'Status',
                data: {
                    State: this.currentState,
                    Commission: currentCommName,
                    Progress: progressStr,
                    Completed: String(this.commissionsCompleted),
                    [toolInfo.type]: toolDisplay,
                },
            },
        ]);
    }

    onEnable() {
        MacroState.setMacroRunning(true, 'COMMISSION');
        Chat.message('&aCommission Macro Enabled.');

        this.commissionsCompleted = 0;

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

        if (this.isActualDrill) {
            Chat.message(`&aUsing drill: &b${itemName}`);
        } else {
            Chat.message(`&aUsing pickaxe: &b${itemName}`);
        }

        this.weapon = this.getWeaponFromSlot();
        if (!this.weapon) {
            Chat.message('&eNo weapon found in Goblin Slayer slot. Goblin commissions will be skipped.');
        } else {
            Chat.message(`&aUsing weapon: &b${this.weapon.name}`);
        }

        this.miningSpeed = MiningUtils.getMiningSpeed('Dwarven Mines');
        if (!this.miningSpeed) {
            Chat.message('&cNo mining speed saved! Run /getminingstats');
            this.toggle(false);
            return;
        }

        this.resetState();
        this.updateOverlay();
    }

    onDisable() {
        MacroState.setMacroRunning(false, 'COMMISSION');
        Chat.message('&cCommission Macro Disabled.');

        MiningBot.toggle(false);
        CombatBot.clearExternalTargets();
        CombatBot.toggle(false);
        stopPathing();
        Keybind.setKey('rightclick', false);
        Guis.EnableUserInput();
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
        this.pathfinding = false;
        this.lastCompletedCommissionName = null;

        CombatBot.clearExternalTargets();
        CombatBot.toggle(false);
    }

    setState(newState) {
        if (this.currentState !== newState) {
            Chat.message(`&aCommission Macro: &eChanging state to ${newState}`);
            this.currentState = newState;
            this.updateOverlay();
        }
    }

    runLogic() {
        if (!this.enabled) return;
        if (this.pauseTicks > 0) {
            this.pauseTicks--;
            return;
        }

        if (this.currentState === STATES.IDLE) this.handleIdle();
        else if (this.currentState === STATES.CHOOSING) this.handleChoosing();
        else if (this.currentState === STATES.WAITING_GUI_CLOSE) this.handleWaitingGuiClose();
        else if (this.currentState === STATES.SLAYER) this.handleSlayer();
        else if (this.currentState === STATES.SELLING) this.handleSelling();
        else if (this.currentState === STATES.CLAIMING) this.handleClaiming();
    }
    handleIdle() {
        this.setState(STATES.CHOOSING);
    }

    handleChoosing() {
        const newCommissions = MiningUtils.readCommissions();
        this.updateCommissionsIfChanged(newCommissions);
        if (this.awaitingTabUpdate) return;

        if (this.lastCompletedCommissionName) {
            const staleCommission = this.commissions.find((c) => c.name === this.lastCompletedCommissionName && c.progress > 0);
            if (staleCommission) {
                return;
            }
            this.lastCompletedCommissionName = null;
        }

        const hasCompleted = this.commissions.some((c) => c.progress === 1);
        if (hasCompleted) {
            this.onCommissionComplete();
            return;
        }

        const activeCommissions = this.commissions.filter((c) => c.progress < 1);
        if (activeCommissions.length === 0) {
            Chat.message('No commissions detected.');
            Chat.message('Ensure commissions are enabled in /tab');
            this.toggle(false);
            return;
        }

        const supportedTasks = this.getSupportedTasks(activeCommissions);
        if (supportedTasks.length === 0) {
            Chat.message('&eNo supported commissions available.');
            this.toggle(false);
            return;
        }

        const otherPlayers = this.getOtherPlayers();
        const chosenCommission = this.findAvailableCommission(supportedTasks, otherPlayers);

        if (chosenCommission) {
            this.startCommission(chosenCommission);
        } else {
            this.handleNoAvailableSpots(supportedTasks);
        }
    }

    getSupportedTasks(activeCommissions) {
        return activeCommissions
            .map((tabComm) => {
                const data = COMMISSION_DATA.find((d) => d.names.includes(tabComm.name));
                return data ? { ...tabComm, ...data } : null;
            })
            .filter((task) => {
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
            })
            .sort((a, b) => a.cost - b.cost);
    }

    getOtherPlayers() {
        if (this.playerAvoidanceRadius <= 0) return [];
        return World.getAllPlayers().filter((p) => p.getName() !== Player.getName());
    }

    findAvailableCommission(supportedTasks, otherPlayers) {
        for (const task of supportedTasks) {
            const safeWaypoints = this.getSafeWaypoints(task.waypoints, otherPlayers);
            if (safeWaypoints.length > 0) {
                const closestWaypoint = this.getClosestWaypoint(safeWaypoints);
                return { task, waypoint: closestWaypoint };
            }
        }
        return null;
    }

    getSafeWaypoints(waypoints, otherPlayers) {
        if (this.playerAvoidanceRadius <= 0) return waypoints;

        return waypoints.filter((waypoint) => {
            return !otherPlayers.some((player) => {
                const distance = this.getDistance(player.getX(), player.getY(), player.getZ(), ...waypoint);
                return distance < this.playerAvoidanceRadius;
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
        const { task, waypoint } = chosenCommission;
        this.currentCommission = task;
        this.travelPurpose = task.type;
        this.currentMiningWaypoint = waypoint;

        Chat.message(`&aStarting commission: &b${task.name}&a. Pathing to: &b[${waypoint.join(', ')}]`);

        this.setState(STATES.TRAVELING);
        findAndFollowPath([Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())], waypoint, (success) =>
            this.onPathComplete(success)
        );
    }

    handleNoAvailableSpots(supportedTasks) {
        const commissionNames = supportedTasks.map((t) => t.name).join('&7, &b');
        Chat.message(`&cAll spots occupied for: &b${commissionNames}&c. Waiting...`);
    }

    handleSlayer() {
        if (!this.currentMobConfig) {
            CombatBot.clearExternalTargets();
            CombatBot.toggle(false);
            return;
        }

        const mobs = CombatBot.findMob(this.currentMobConfig, this.mobWhitelist);
        if (!mobs || mobs.length === 0) {
            CombatBot.clearExternalTargets();
            return;
        }

        CombatBot.setExternalTargets(mobs);
        if (!CombatBot.enabled) {
            CombatBot.toggle(true);
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
        const items = container.getItems();

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
        if (Guis.guiName() === 'Commissions') {
            this.claimCompletedCommissions();
            return;
        }

        const pigeonSlot = Guis.findItemInHotbar('Royal Pigeon');
        if (pigeonSlot !== -1) {
            this.useRoyalPigeon(pigeonSlot);
            return;
        } else {
            this.travelToEmissary();
        }
    }

    useRoyalPigeon(pigeonSlot) {
        if (Player.getHeldItemIndex() != pigeonSlot) {
            Guis.setItemSlot(pigeonSlot);
            this.delay(3);
        } else {
            Keybind.rightClick();
            this.delay(10);
        }
    }

    claimCompletedCommissions() {
        const Commissions = Player.getContainer();
        for (let i = 9; i < 17; i++) {
            const stack = Commissions.getStackInSlot(i);
            if (!stack) continue;

            const hasCompleted = stack.getLore().some((line) => line.toString().includes('COMPLETED'));
            if (hasCompleted) {
                Guis.clickSlot(i, false);
                this.delay(10);
                return;
            }
        }

        Guis.closeInv();
        this.setState(STATES.WAITING_GUI_CLOSE);
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

    travelToEmissary() {
        const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
        const closest = this.getClosestEmissary(playerPos);
        const closestDist = this.getDistance(...playerPos, ...closest);

        if (closestDist < 4) {
            this.interactWithEmissary(closest);
        } else {
            this.pathToEmissary(closest);
        }
    }

    getClosestEmissary(playerPos) {
        let closest = EMISSARY_LOCATIONS[0];
        let closestDist = this.getDistance(...playerPos, ...closest);

        for (let i = 1; i < EMISSARY_LOCATIONS.length; i++) {
            const current = EMISSARY_LOCATIONS[i];
            const currentDist = this.getDistance(...playerPos, ...current);
            if (currentDist < closestDist) {
                closest = current;
                closestDist = currentDist;
            }
        }
        return closest;
    }

    interactWithEmissary(target) {
        const adjustedTarget = [target[0] + 0.5, target[1] + 2.2, target[2] + 0.5];
        if (Rotations.isRotating) return;

        Rotations.rotateToVector(adjustedTarget);
        Rotations.onEndRotation(() => {
            Keybind.rightClick();
            this.delay(10);
        });
    }

    pathToEmissary(closest) {
        if (this.pathfinding) return;

        this.pathfinding = true;
        this.travelPurpose = 'EMISSARY';
        findAndFollowPath([Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())], closest, (success) => {
            if (!success) return;
            this.pathfinding = false;
        });
    }

    delay(ticks) {
        this.pauseTicks = Math.max(0, Math.floor(Number(ticks) || 0));
    }

    getDistance(x1, y1, z1, x2, y2, z2) {
        return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    }

    onPathComplete(success) {
        if (!this.enabled) return;
        if (!success) return;

        if (this.travelPurpose === 'EMISSARY') {
            this.travelPurpose = null;
            this.setState(STATES.CLAIMING);
            return;
        }

        Chat.message(`&aArrived at destination for &b${this.currentCommission?.name || 'Unknown'}`);

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
    }

    onPathFail() {
        if (!this.enabled) return;
        Chat.message(`&cFailed to find a path for &b${this.currentCommission?.name || 'Unknown'}. Retrying...`);
        this.currentCommission = null;
        this.setState(STATES.IDLE);
    }

    startMining() {
        if (Client.isInGui()) {
            Chat.message('&eWaiting for GUI to close before mining...');
            this.delay(5);
            return;
        }

        const drills = MiningUtils.getDrills();
        this.drill = drills.drill;

        if (!this.drill) {
            Chat.message('&cERROR: No drill or pickaxe found!');
            this.toggle(false);
            return;
        }

        const itemName = ChatLib.removeFormatting(this.drill.item.getName());
        this.isActualDrill = itemName.includes('Drill') || itemName.includes('Gauntlet');

        Guis.setItemSlot(this.drill.slot);
        this.updateOverlay();

        const isTitaniumCommission = this.currentCommission.name.includes('Titanium');
        MiningBot.setPrioritizeTitanium(isTitaniumCommission);

        MiningBot.setCost(MiningBot.mithrilCosts);
        MiningBot.toggle(true);
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
            Chat.message('&cUnknown slayer commission type!');
            this.toggle(false);
            return;
        }

        this.updateOverlay();

        this.currentMobConfig = MOB_CONFIGS[mobType];
        if (!this.currentMobConfig) {
            Chat.message(`&cNo mob config found for: ${mobType}`);
            this.toggle(false);
            return;
        }

        CombatBot.clearExternalTargets();
        if (!CombatBot.enabled) {
            CombatBot.toggle(true);
        }
    }

    onCommissionComplete() {
        Chat.message('&aCommission complete detected!');
        stopPathing();
        MiningBot.toggle(false);

        CombatBot.clearExternalTargets();
        CombatBot.toggle(false);

        this.lastCompletedCommissionName = this.currentCommission?.name || null;
        this.awaitingTabUpdate = true;
        this.setState(STATES.CLAIMING);
    }

    onInventoryFull() {
        Chat.message('&eInventory full! Selling items...');
        MiningBot.toggle(false);
        this.savedState = this.currentState;
        this.setState(STATES.SELLING);
    }

    onDrillEmpty() {
        if (!this.isActualDrill) {
            Chat.message('&eDrill empty event but using pickaxe. Wtf????');
            return;
        }

        Chat.message('&eDrill empty! Refueling...');
        MiningBot.toggle(false);
        this.setState(STATES.REFUELING);

        MiningUtils.doRefueling(true, (success) => {
            if (!success) {
                Chat.message('&cRefueling failed! No fuel found.');
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

    updateCommissionsIfChanged(newCommissions) {
        if (JSON.stringify(this.commissions) === JSON.stringify(newCommissions)) return;

        this.commissions = newCommissions;

        if (this.awaitingTabUpdate) {
            const stillCompleted = this.commissions.some((c) => c.progress === 1);
            if (!stillCompleted) {
                if (this.lastCompletedCommissionName) {
                    const sameNameComm = this.commissions.find((c) => c.name === this.lastCompletedCommissionName);
                    if (!sameNameComm || sameNameComm.progress === 0) {
                        this.awaitingTabUpdate = false;
                    }
                } else {
                    this.awaitingTabUpdate = false;
                }
            }
        }

        this.updateOverlay();
    }
}

new CommissionMacro();
