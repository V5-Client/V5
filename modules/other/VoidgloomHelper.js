import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { findItemInHotbar, setItemSlot } from '../../utils/player/Inventory';

const ACTION = {
    IDLE: 'idle',
    USE: 'use',
    RETURN: 'return',
};

const FEATURE = {
    SOULCRY: 'soulcry',
    DEPLOY: 'deploy',
};

const HELD_ITEM_SWAP_BLACKLIST = ['ragnarock'];

class VoidgloomHelper extends ModuleBase {
    constructor() {
        super({
            name: 'modules.voidgloom_helper.name',
            subcategory: 'Other',
            description: 'modules.voidgloom_helper.description',
            tooltip: 'modules.voidgloom_helper.tooltip',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
        });
        this.bindToggleKey();

        this.lastSoulcry = 0;
        this.swapBackSlot = -1;
        this.targetSlot = -1;
        this.currentFeature = null;
        this.actionPhase = ACTION.IDLE;
        this.pendingDeploy = false;
        this.bossActive = false;
        this.lastOwnStandSeen = 0;
        this.enableSoulcry = true;
        this.soulcryBossOnly = false;
        this.enableDeploy = true;

        this.addToggle(
            'labels.auto_soulcry',
            (value) => {
                this.enableSoulcry = !!value;
                if (!this.enableSoulcry && this.currentFeature === FEATURE.SOULCRY) this.resetAction();
            },
            'descriptions.auto_soulcry',
            true
        );

        this.addToggle(
            'labels.boss_only_soulcry',
            (value) => {
                this.soulcryBossOnly = !!value;
                if (this.soulcryBossOnly && !this.bossActive && this.currentFeature === FEATURE.SOULCRY) this.resetAction();
            },
            'descriptions.boss_only_soulcry',
            false
        );

        this.addToggle(
            'labels.auto_deployable',
            (value) => {
                this.enableDeploy = !!value;
                if (!this.enableDeploy) {
                    this.pendingDeploy = false;
                    if (this.currentFeature === FEATURE.DEPLOY) this.resetAction();
                }
            },
            'descriptions.auto_deployable',
            true
        );

        this.on('tick', () => this.handleTick());
        this.on('step', () => this.detectBossSpawn()).setDelay(1);
    }

    detectBossSpawn() {
        if (!this.enableDeploy) {
            this.pendingDeploy = false;
        }

        const now = Date.now();
        const stands = World.getAllEntitiesOfType(ArmorStandEntity);
        let detected = false;

        stands.forEach((stand) => {
            if (detected) return;
            const standName = typeof stand.getName === 'function' ? stand.getName() : '';
            if (!standName.includes('Spawned by')) return;
            const name = ChatLib.removeFormatting(standName).split('by: ')[1];
            const playerName = Player.getName ? Player.getName() : '';
            if (!name || !playerName) return;
            if (name.toLowerCase() === String(playerName).toLowerCase()) {
                detected = true;
            }
        });

        if (detected) {
            this.lastOwnStandSeen = now;
            if (!this.bossActive) {
                this.bossActive = true;
                if (this.enableDeploy) {
                    this.pendingDeploy = true;
                    this.message('messages.voidgloom.deployingOrb');
                }
            }
        }

        if (this.bossActive && now - this.lastOwnStandSeen > 5000) {
            this.bossActive = false;
        }
    }

    handleTick() {
        if (!this.enableDeploy) {
            this.pendingDeploy = false;
        }

        if (this.actionPhase !== ACTION.IDLE) {
            this.progressAction();
            return;
        }

        if (this.isHoldingBlacklistedItem()) return;

        if (this.enableDeploy && this.pendingDeploy) {
            const deploySlot = this.findDeployableSlot();
            if (deploySlot !== -1) {
                this.beginAction(FEATURE.DEPLOY, deploySlot);
            } else {
                this.pendingDeploy = false;
            }
            return;
        }

        const katanaSlot = findItemInHotbar('Katana');
        if (this.enableSoulcry && (!this.soulcryBossOnly || this.bossActive) && katanaSlot !== -1 && this.canSoulcry(katanaSlot)) {
            this.beginAction(FEATURE.SOULCRY, katanaSlot);
        }
    }

    progressAction() {
        if (this.targetSlot === -1) {
            this.resetAction();
            return;
        }

        if ((this.currentFeature === FEATURE.SOULCRY && !this.enableSoulcry) || (this.currentFeature === FEATURE.DEPLOY && !this.enableDeploy)) {
            this.resetAction();
            return;
        }

        if (this.currentFeature === FEATURE.SOULCRY && this.soulcryBossOnly && !this.bossActive) {
            this.resetAction();
            return;
        }

        switch (this.actionPhase) {
            case ACTION.USE:
                if (Player.getHeldItemIndex() !== this.targetSlot) {
                    setItemSlot(this.targetSlot);
                    return;
                }
                if (this.currentFeature === FEATURE.SOULCRY) this.lastSoulcry = Date.now();
                if (this.currentFeature === FEATURE.DEPLOY) this.pendingDeploy = false;

                Client.rightClick();
                this.actionPhase = ACTION.RETURN;
                break;
            case ACTION.RETURN:
                if (this.swapBackSlot !== -1 && this.swapBackSlot !== Player.getHeldItemIndex()) {
                    setItemSlot(this.swapBackSlot);
                    return;
                }
                this.resetAction();
                break;
            default:
                this.resetAction();
                break;
        }
    }

    beginAction(feature, slot) {
        if (this.actionPhase !== ACTION.IDLE) return;
        this.currentFeature = feature;
        this.targetSlot = slot;
        this.swapBackSlot = Player.getHeldItemIndex();
        this.actionPhase = ACTION.USE;
    }

    resetAction() {
        this.actionPhase = ACTION.IDLE;
        this.currentFeature = null;
        this.targetSlot = -1;
        this.swapBackSlot = -1;
    }

    canSoulcry(katanaSlot) {
        if (katanaSlot === -1) return false;
        const inv = Player.getInventory();
        if (!inv) return false;
        const items = inv.getItems();
        if (!items || !items[katanaSlot]) return false;

        const typeName = String(items[katanaSlot].getType().getName()).toLowerCase();
        if (!typeName.includes('diamond sword')) return false;
        return Date.now() - this.lastSoulcry > 1000;
    }

    findDeployableSlot() {
        const targets = ['Power Orb', 'Flare'];
        for (const target of targets) {
            const slot = findItemInHotbar(target);
            if (slot !== -1) return slot;
        }
        return -1;
    }

    isHoldingBlacklistedItem() {
        const heldName = ChatLib.removeFormatting(Player.getHeldItem()?.getName?.() ?? '').toLowerCase();
        return HELD_ITEM_SWAP_BLACKLIST.some((name) => heldName.includes(name));
    }

    onEnable() {
        this.message('messages.common.enabled');
    }

    onDisable() {
        this.message('messages.common.disabled');
        this.resetAction();
        this.pendingDeploy = false;
        this.bossActive = false;
        this.lastOwnStandSeen = 0;
    }
}

new VoidgloomHelper();
