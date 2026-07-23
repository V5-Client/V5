import { ModuleBase } from '../../utils/ModuleBase';
import { ClientboundSetTitleTextPacket } from '../../utils/Packets';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { manager } from '../../utils/SkyblockEvents';
import { Mouse } from '../../utils/Ungrab';

const FISH_POSITIONS = [
    0xfa07, 0xfa12, 0xfa18, 0xfa36, 0xfa40, 0xfa51, 0xfa52, 0xfa59, 0xfa60, 0xfa63, 0xfa64, 0xfa77, 0xfa00, 0xfa15, 0xfa24, 0xfa35, 0xfa70, 0xfa79, 0xfa85,
    0xfa03, 0xfa05, 0xfa17, 0xfa26, 0xfa37, 0xfa38, 0xfa45, 0xfa53, 0xfa73, 0xfa96, 0xfa97, 0xfa01, 0xfa11, 0xfa14, 0xfa22, 0xfa32, 0xfa46, 0xfa47, 0xfa68,
    0xfa78, 0xfa82, 0xfa21, 0xfa39, 0xfa48, 0xfa74, 0xfa75, 0xfa86, 0xfa91, 0xfa08, 0xfa13, 0xfa43, 0xfa55, 0xfa57, 0xfa65, 0xfa71, 0xfa72, 0xfa76, 0xfa84,
    0xfa89, 0xfa02, 0xfa04, 0xfa09, 0xfa30, 0xfa31, 0xfa41, 0xfa44, 0xfa56, 0xfa80, 0xfa87, 0xfa94, 0xfa25, 0xfa27, 0xfa28, 0xfa66, 0xfa67, 0xfa81, 0xfa83,
    0xfa93, 0xfa95, 0xfa98, 0xfa99, 0xfa10, 0xfa20, 0xfa29, 0xfa34, 0xfa49, 0xfa50, 0xfa61, 0xfa88, 0xfa92, 0xfaaa, 0xfa06, 0xfa16, 0xfa19, 0xfa23, 0xfa33,
    0xfa42, 0xfa54, 0xfa58, 0xfa62, 0xfa69, 0xfa90,
];

const VALUE_LORE = 'ᴠᴀʟᴜᴇ:';
const QUEST_READY_LORE = 'ʀᴇᴀᴅʏ ᴛᴏ ᴄʟᴀɪᴍ';
const QUEST_TYPE_LORE = 'ᴄʟɪᴄᴋ ᴛᴏ sᴛᴀʀᴛ ᴀ ꞯᴜᴇsᴛ';
const EASY_QUEST_LORE = 'Click to start an easy quest.';
const START_QUEST_LORE = 'Click to start.';

const STATES = {
    FISHING: 0,
    PATHING_TO_MERCHANT: 1,
    OPENING_MERCHANT: 2,
    SELLING: 3,
    RETURNING: 4,
    RESTORING_ROTATION: 5,
    QUEST_OPENING: 6,
    QUEST_CLAIMING: 7,
    QUEST_SELECTING_DIFFICULTY: 8,
    QUEST_STARTING: 9,
};

class FishOnMCMacro extends ModuleBase {
    constructor() {
        super({
            name: 'FishOnMCMacro',
            subcategory: 'Skills',
            description: 'Keeps the fishing minigame marker centred',
            tooltip: 'Holds Shift below the centre and releases it above.',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.lastFishAt = 0;
        this.lastCastAt = 0;
        this.castToken = 0;
        this.state = STATES.FISHING;
        this.start = null;
        this.merchant = null;
        this.inventoryWasFull = false;
        this.questPending = false;
        this.lastQuestActionAt = 0;

        this.on('packetReceived', (packet) => {
            if (this.state !== STATES.FISHING) return;

            const actionBar = String(packet.text().getString());
            let position = -1;
            for (let i = 0; i < actionBar.length; i++) {
                position = FISH_POSITIONS.indexOf(actionBar.charCodeAt(i));
                if (position !== -1) break;
            }

            if (position === -1) return;

            this.lastFishAt = Date.now();
            Client.setKey('shift', position < 50);
        }).setFilteredClass(net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket);

        this.on('packetReceived', (packet) => {
            if (this.state !== STATES.FISHING) return;

            const title = String(packet.text().getString());
            if (title === 'BITE!') Client.rightClick();
        }).setFilteredClass(ClientboundSetTitleTextPacket);

        this.on('chat', (event) => {
            const message = ChatLib.removeFormatting(String(event.message));
            if (message.includes('is available to turn in! Type /quests to claim it.')) {
                this.questPending = true;
                this.message('&eQuest queued.');
            }
        });

        this.on('tick', () => {
            const inventoryFull = this.isInventoryFull();
            const inventoryBecameFull = inventoryFull && !this.inventoryWasFull;
            this.inventoryWasFull = inventoryFull;

            if (this.state >= STATES.QUEST_OPENING) {
                this.handleQuests();
                return;
            }

            if (this.state === STATES.OPENING_MERCHANT) {
                if (Player.getContainer()) this.state = STATES.SELLING;
                return;
            }

            if (this.state === STATES.SELLING) {
                if (!this.sellNextValueItem()) this.returnToStart();
                return;
            }

            if (this.state === STATES.FISHING && inventoryBecameFull) {
                this.sellInventory();
                return;
            }

            if (this.state === STATES.FISHING && !this.hasFishingHook() && Date.now() - this.lastCastAt >= 500) {
                this.lastFishAt = 0;
                this.castRod();
                return;
            }

            if (this.state !== STATES.FISHING || !this.lastFishAt || Date.now() - this.lastFishAt < 500) return;

            Client.setKey('shift', false);
            this.castRod();
            this.lastFishAt = 0;
        });

        manager.subscribe('fullinventory', () => {
            if (this.enabled && this.state === STATES.FISHING) this.sellInventory();
        });
    }

    onEnable() {
        this.message('&aEnabled');
        this.lastFishAt = 0;
        this.lastCastAt = 0;
        this.state = STATES.FISHING;
        this.inventoryWasFull = false;
        this.questPending = false;
        this.lastQuestActionAt = 0;
        this.start = {
            position: [Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ())],
            yaw: Player.getYaw(),
            pitch: Player.getPitch(),
        };
        Client.setKey('shift', false);
        Mouse.ungrab();
        this.castRod();
    }

    onDisable() {
        this.castToken++;
        this.message('&cDisabled');
        Client.setKey('shift', false);
        Pathfinder.resetPath();
        Rotations.stop();
        if (this.state === STATES.OPENING_MERCHANT || this.state === STATES.SELLING || this.state >= STATES.QUEST_OPENING) Guis.closeInv();
        Mouse.regrab();
    }

    sellInventory() {
        const merchants = World.getAllEntities().filter((entity) => ChatLib.removeFormatting(String(entity.getName?.() || '')).includes('FISH MERCHANT'));
        if (!merchants.length) {
            this.message('&cNo Fish Merchant found.');
            return;
        }

        this.message('&eInventory full! Selling items...');
        this.lastFishAt = 0;
        Client.setKey('shift', false);
        this.merchant = merchants.reduce((closest, entity) => {
            const distance = Math.hypot(entity.getX() - Player.getX(), entity.getY() - Player.getY(), entity.getZ() - Player.getZ());
            const closestDistance = Math.hypot(closest.getX() - Player.getX(), closest.getY() - Player.getY(), closest.getZ() - Player.getZ());
            return distance < closestDistance ? entity : closest;
        });
        this.state = STATES.PATHING_TO_MERCHANT;

        Pathfinder.resetPath();
        const x = Math.floor(this.merchant.getX());
        const y = Math.floor(this.merchant.getY());
        const z = Math.floor(this.merchant.getZ());
        Pathfinder.findPath(
            [
                [x, y - 1, z],
                [x, y - 2, z],
                [x, y - 3, z],
            ],
            (success) => {
                if (!this.enabled || this.state !== STATES.PATHING_TO_MERCHANT) return;
                if (!success) {
                    this.message('&cCould not path to Fish Merchant.');
                    this.state = STATES.FISHING;
                    return;
                }

                this.openMerchant();
            }
        );
    }

    isInventoryFull() {
        const items = Player.getInventory()?.getItems();
        return !!items && items.length >= 36 && items.slice(0, 36).every((item) => item != null);
    }

    openMerchant() {
        const aimPoint = [this.merchant.getX(), this.merchant.getY() - 1, this.merchant.getZ()];
        this.state = STATES.OPENING_MERCHANT;

        if (!Rotations.lookAtVector(aimPoint)) {
            Client.rightClick();
            return;
        }

        Rotations.onComplete(() => {
            if (this.enabled && this.state === STATES.OPENING_MERCHANT) Client.rightClick();
        });
    }

    sellNextValueItem() {
        const items = Player.getContainer()?.getItems();
        if (!items || items.length <= 36) return false;

        for (let slot = items.length - 36; slot < items.length; slot++) {
            const item = items[slot];
            if (item?.getLore?.()?.some((line) => ChatLib.removeFormatting(String(line)).includes(VALUE_LORE))) {
                Guis.clickSlot(slot, false, 'LEFT');
                return true;
            }
        }
        return false;
    }

    returnToStart() {
        Guis.closeInv();
        if (!this.start) {
            this.state = STATES.FISHING;
            return;
        }

        this.state = STATES.RETURNING;
        Pathfinder.resetPath();
        Pathfinder.findPath([this.start.position], (success) => {
            if (!this.enabled || this.state !== STATES.RETURNING) return;
            if (!success) {
                this.message('&cCould not return to fishing spot.');
                this.state = STATES.FISHING;
                return;
            }

            this.restoreFishingRotation();
        });
    }

    restoreFishingRotation() {
        this.state = STATES.RESTORING_ROTATION;
        if (!Rotations.lookAtAngles(this.start.yaw, this.start.pitch)) {
            this.resumeFishing();
            return;
        }

        Rotations.onComplete(() => {
            if (this.enabled && this.state === STATES.RESTORING_ROTATION) this.resumeFishing();
        });
    }

    resumeFishing() {
        this.state = STATES.FISHING;
        this.castRod();
    }

    claimAndStartQuests() {
        this.questPending = false;
        this.state = STATES.QUEST_OPENING;
        this.lastQuestActionAt = 0;
        this.message('&eOpening quests...');
        if (this.hasFishingHook()) Client.rightClick();
        ScheduleTask(3, () => {
            if (this.enabled && this.state === STATES.QUEST_OPENING) ChatLib.command('quests');
        });
    }

    handleQuests() {
        const container = Player.getContainer();
        if (this.state === STATES.QUEST_OPENING) {
            if (container) this.state = STATES.QUEST_CLAIMING;
            return;
        }

        if (!container || Date.now() - this.lastQuestActionAt < 250) return;

        if (this.state === STATES.QUEST_CLAIMING) {
            const readySlots = this.findLoreSlots(QUEST_READY_LORE);
            if (readySlots.length) return this.clickQuestSlot(readySlots[0]);

            const typeSlots = this.findLoreSlots(QUEST_TYPE_LORE);
            if (typeSlots.length) {
                this.state = STATES.QUEST_SELECTING_DIFFICULTY;
                return this.clickQuestSlot(typeSlots[0]);
            }

            Guis.closeInv();
            this.resumeFishing();
            return;
        }

        if (this.state === STATES.QUEST_SELECTING_DIFFICULTY) {
            const easySlots = this.findLoreSlots(EASY_QUEST_LORE);
            if (!easySlots.length) return;

            this.state = STATES.QUEST_STARTING;
            return this.clickQuestSlot(easySlots[easySlots.length - 1]);
        }

        if (this.state === STATES.QUEST_STARTING) {
            const startSlots = this.findLoreSlots(START_QUEST_LORE);
            if (!startSlots.length) return;

            this.state = STATES.QUEST_CLAIMING;
            return this.clickQuestSlot(startSlots[Math.floor(Math.random() * startSlots.length)]);
        }
    }

    findLoreSlots(target) {
        const items = Player.getContainer()?.getItems() || [];
        const slots = [];
        for (let slot = 0; slot < items.length; slot++) {
            if (items[slot]?.getLore?.()?.some((line) => ChatLib.removeFormatting(String(line)).includes(target))) slots.push(slot);
        }
        return slots;
    }

    clickQuestSlot(slot) {
        if (Guis.clickSlot(slot, false, 'LEFT')) this.lastQuestActionAt = Date.now();
    }

    castRod() {
        if (this.questPending) {
            this.claimAndStartQuests();
            return;
        }

        this.lastCastAt = Date.now();
        if (!this.hasFishingHook()) {
            Client.rightClick();
            return;
        }

        Client.rightClick();
        const token = ++this.castToken;
        ScheduleTask(4, () => {
            if (this.enabled && token === this.castToken && this.state === STATES.FISHING) {
                this.lastCastAt = Date.now();
                Client.rightClick();
            }
        });
    }

    hasFishingHook() {
        return World.getAllEntities().some((entity) => {
            if (entity.getClassName() !== 'FishingHook') return false;

            const name = entity.toMC().getPlayerOwner()?.getName?.();
            return String(name?.getString?.() ?? name) === Player.getName();
        });
    }
}

new FishOnMCMacro();
