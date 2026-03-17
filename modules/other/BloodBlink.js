import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { CommonPingS2C, WorldTimeUpdateS2C } from '../../utils/Packets';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { mc, Utils } from '../../utils/Utils';

let DungeonScanner;
let roomsField;
let currentRoomField;

const RIGHT_CLICK_METHOD = mc.getClass().getDeclaredMethod('method_1583');
RIGHT_CLICK_METHOD.setAccessible(true);

class BloodBlink extends ModuleBase {
    constructor() {
        super({
            name: 'Blood Blink',
            subcategory: 'Other',
            description: 'Requires the following enabled: Devonian Mod, Auto GFS, Cancel Interact (V5).',
            tooltip: 'Blinks to the Blood Room at the start of a dungeon.',
        });

        this.reflectionFailed = false;

        try {
            DungeonScanner = Java.type('com.github.synnerz.devonian.api.dungeon.DungeonScanner');
            roomsField = DungeonScanner.class.getDeclaredField('rooms');
            roomsField.setAccessible(true);
            currentRoomField = DungeonScanner.class.getDeclaredField('currentRoom');
            currentRoomField.setAccessible(true);
        } catch (e) {
            this.reflectionFailed = true;
        }

        this.pearlSlot = -1;
        this.aotvSlot = -1;
        this.blinkDelay = -1;
        this.outbounds = 0;
        this.blinkReady = 0;
        this.dungeonStarted = true;
        this.setupBlinkRunning = false;
        this.blinkRunning = false;

        this.on('tick', () => {
            this.pearlSlot = Guis.findItemInHotbar('Ender Pearl');
            this.aotvSlot = Guis.findItemInHotbar('Aspect of the Void');
            if (this.aotvSlot === -1) this.aotvSlot = Guis.findItemInHotbar('Aspect of the End');
            if (this.blinkDelay >= 0 && --this.blinkDelay <= 0) {
                this.blinkDelay = -1;
                this.blink();
            }
        });

        register('command', (...args) => {
            const customRoomName = (args || []).join(' ').trim();
            this.blink(true, customRoomName || 'blood');
        }).setName('BloodBlink');

        this.on('packetReceived', (packet) => {
            this.outbounds = 40 - (packet?.time?.() % 40);
        }).setFilteredClass(WorldTimeUpdateS2C);

        this.on('packetReceived', () => {
            const player = Player.getPlayer();
            if (!player) return;

            if (this.outbounds == 0) this.outbounds = 40;
            else this.outbounds = this.outbounds - 1;
            if (!Utils.subArea().startsWith('The Catacombs')) return;
            if (this.outbounds > 25 && Date.now() - this.blinkReady <= 3000 && (player.getY() == 71 || player.getY() == 72)) this.setupBlink();
            if (this.dungeonStarted) return;
            if (this.outbounds > 30 || this.outbounds < 10) return;
            if (player.getY() == 71 || player.getY() == 72) return this.setupBlink();
        }).setFilteredClass(CommonPingS2C);

        this.on('chat', (event) => {
            const msg = event.message.getUnformattedText();
            const catacombsEntryRegex = /(?:\[[^\]]+\]\s+)?[A-Za-z0-9_]{1,16} entered (?:MM )?The Catacombs, [^!\n]+!/;
            if (catacombsEntryRegex.test(msg)) {
                this.dungeonStarted = false;
                Chat.message('BloodBlink Dungeon Detected');
            }

            if (msg == 'Starting in 1 second.') this.dungeonStarted = true;
            if (msg == '§e[NPC] §bMort§f: Here, I found this map when I first entered the dungeon.') {
                Chat.message('BloodBlink Dungeon Start Detected');
                this.blinkReady = Date.now();
            }
        });

        this.on('worldLoad', () => this.reset());
        this.on('worldUnload', () => this.reset());
    }

    onEnable() {
        this.reset();
    }

    onDisable() {
        this.blinkDelay = -1;
        this.setupBlinkRunning = false;
        this.blinkRunning = false;
    }

    reset() {
        this.blinkDelay = -1;
        this.outbounds = 0;
        this.blinkReady = 0;
        this.setupBlinkRunning = false;
        this.blinkRunning = false;
    }

    getBloodCenter(roomName = 'blood') {
        if (this.reflectionFailed || !DungeonScanner || !roomsField) return null;
        const rooms = roomsField.get(DungeonScanner.INSTANCE);
        if (!rooms) return null;
        const roomQuery = roomName.toString().trim().toLowerCase() || 'blood';
        for (const room of rooms) {
            const name = room?.name?.toString();
            if (name && name.toLowerCase().includes(roomQuery)) {
                const center = this.getRoomCenter(room);
                if (center) return center;
            }
        }

        return null;
    }

    getRoomCenter(room) {
        if (!room) return null;

        const center = this.readPair(room.fromComp(15, 15));
        if (!center) return null;
        return { x: center.x, z: center.z };
    }

    readPair(pair) {
        if (!pair) return null;
        return { x: pair.getFirst(), z: pair.getSecond() };
    }

    getBloodX() {
        const player = Player.getPlayer();
        if (!player) return 0;
        const center = this.getBloodCenter();
        return center ? center.x : this.getOppositeCoord(player.getX());
    }

    getBloodZ() {
        const player = Player.getPlayer();
        if (!player) return 0;
        const center = this.getBloodCenter();
        return center ? center.z : this.getOppositeCoord(player.getZ());
    }

    getOppositeCoord(coord) {
        const t = Math.min(1, Math.max(0, -coord / 200));
        return -150 + t * 100;
    }

    repeatRightClick(count) {
        const times = Math.max(0, Math.abs(Math.round(count)));
        for (let i = 0; i < times; i++) {
            this.rightClick();
        }
    }

    rightClick() {
        RIGHT_CLICK_METHOD.invoke(mc);
    }

    setHeldItemSafe(slot) {
        if (slot < 0 || slot > 8) return false;
        Player.setHeldItemIndex(slot);
        return true;
    }

    blink(force = false, roomName = 'blood') {
        if (this.blinkRunning || this.setupBlinkRunning) return;
        const player = Player.getPlayer();
        if (!player) return;
        this.blinkRunning = true;
        Chat.message('BloodBlink Blink Blood');
        if (this.reflectionFailed) {
            Chat.message('&c[Blood Blink] Failed to access Devonian DungeonScanner. Please install devonian or disable Blood Blink.');
            this.blinkRunning = false;
            return;
        }

        const bloodCenter = this.getBloodCenter(roomName);
        const playerX = player.getX();
        const playerY = player.getY();
        const playerZ = player.getZ();
        const bloodX = bloodCenter ? bloodCenter.x : this.getOppositeCoord(playerX);
        const bloodZ = bloodCenter ? bloodCenter.z : this.getOppositeCoord(playerZ);

        const closest = { x: -220, z: -220 };

        const upTo210LeapsY = Math.round((220 - playerY) / 12);
        const toCornerLeapsX = Math.round((closest.x - playerX) / 12);
        const toCornerLeapsXDelta = Math.round((toCornerLeapsX - (closest.x - playerX) / 12) * 12);
        const toCornerLeapsZ = Math.round((closest.z - playerZ) / 12);
        const toCornerLeapsZDelta = Math.round((toCornerLeapsZ - (closest.z - playerZ) / 12) * 12);
        const downTo30LeapsY = Math.round(300 / 12);
        const toBloodLeapsX = Math.round((bloodX - closest.x - toCornerLeapsXDelta) / 12);
        const toBloodLeapsZ = Math.round((bloodZ - closest.z - toCornerLeapsZDelta) / 12);
        const directToBloodLeapsX = Math.round((bloodX - playerX) / 12);
        const directToBloodLeapsZ = Math.round((bloodZ - playerZ) / 12);
        const yawForX = (dx) => (dx >= 0 ? -90 : 90);
        const yawForZ = (dz) => (dz >= 0 ? 0 : 180);

        Rotations.applyRotationWithGCD(0, -90);

        if (bloodCenter) {
            if (!(Date.now() - this.blinkReady <= 3000) && !force) {
                this.blinkDelay = 20;
                this.blinkRunning = false;
                return;
            }
            this.blinkReady = 0;
            Client.scheduleTask(0, () => {
                Rotations.applyRotationWithGCD(Player.getYaw(), -90);
                this.repeatRightClick(upTo210LeapsY);
                Rotations.applyRotationWithGCD(yawForX(closest.x - playerX), 0);
                this.repeatRightClick(toCornerLeapsX);
                Rotations.applyRotationWithGCD(yawForZ(closest.z - playerZ), 0);
                this.repeatRightClick(toCornerLeapsZ);
                Rotations.applyRotationWithGCD(0, 90);
                this.repeatRightClick(downTo30LeapsY);
                Rotations.applyRotationWithGCD(yawForX(bloodX - closest.x), 0);
                this.repeatRightClick(toBloodLeapsX);
                Rotations.applyRotationWithGCD(yawForZ(bloodZ - closest.z), 0);
                this.repeatRightClick(toBloodLeapsZ);
                Rotations.applyRotationWithGCD(0, -90);
                this.repeatRightClick(10);
            });

            Client.scheduleTask(2, () => {
                this.setHeldItemSafe(this.pearlSlot);
            });
            Client.scheduleTask(3, () => {
                this.rightClick();
            });
            Client.scheduleTask(5, () => {
                this.rightClick();
                Rotations.applyRotationWithGCD(0, 90);
            });
            Client.scheduleTask(6, () => {
                this.rightClick();
                this.blinkRunning = false;
            });
        } else {
            Client.scheduleTask(0, () => {
                if (this.dungeonStarted) return Chat.message('Bloodblink fucked up (no blood detected)');
                Rotations.applyRotationWithGCD(0, -90);
                this.repeatRightClick(upTo210LeapsY);
                Rotations.applyRotationWithGCD(yawForX(bloodX - playerX), 0);
                this.repeatRightClick(directToBloodLeapsX);
                Rotations.applyRotationWithGCD(yawForZ(bloodZ - playerZ), 0);
                this.repeatRightClick(directToBloodLeapsZ);
            });
            Client.scheduleTask(1, () => {
                this.blinkRunning = false;
            });
        }
    }

    setupBlink() {
        if (this.setupBlinkRunning || this.blinkRunning) return;
        const player = Player.getPlayer();
        if (!player) return;
        this.setupBlinkRunning = true;
        Chat.message('BloodBlink Blink Setup');
        if (this.reflectionFailed) {
            Chat.message('&c[Blood Blink] Failed to access Devonian DungeonScanner. Please install devonian or disable Blood Blink.');
            this.setupBlinkRunning = false;
            return;
        }
        if (this.aotvSlot === -1 || this.pearlSlot === -1) {
            Chat.message('missing aotv/pearl');
            this.setupBlinkRunning = false;
            return;
        }
        if (player.getY() == 74 || player.getY() >= 97) {
            this.blinkDelay = 0;
            this.setupBlinkRunning = false;
            return;
        } // standing on door method
        Client.scheduleTask(0, () => {
            this.setHeldItemSafe(this.aotvSlot);
        });
        Client.scheduleTask(1, () => {
            Rotations.applyRotationWithGCD(0, -90);
        });
        Client.scheduleTask(2, () => {
            this.rightClick();
        });
        Client.scheduleTask(3, () => {
            this.rightClick();
        });
        Client.scheduleTask(4, () => {
            this.rightClick();
        });
        Client.scheduleTask(5, () => {
            this.setHeldItemSafe(this.pearlSlot);
        });
        Client.scheduleTask(9, () => {
            this.rightClick();
        });
        Client.scheduleTask(11, () => {
            this.rightClick();
        });
        Client.scheduleTask(15, () => {
            this.rightClick();
        });
        Client.scheduleTask(19, () => {
            this.rightClick();
        });
        Client.scheduleTask(23, () => {
            this.rightClick();
        });
        Client.scheduleTask(27, () => {
            this.rightClick();
        });
        Client.scheduleTask(30, () => {
            this.setHeldItemSafe(this.aotvSlot);
        });
        Client.scheduleTask(31, () => {
            this.setupBlinkRunning = false;
        });
        this.blinkDelay = 32;
    }
}

new BloodBlink();
