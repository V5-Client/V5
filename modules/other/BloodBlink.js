import { ModuleBase } from '../../utils/ModuleBase';
import { Rotations } from '../../utils/player/Rotations';
import { mc, Utils } from '../../utils/Utils';
import { Keybind } from '../../utils/player/Keybinding';
import { Chat } from '../../utils/Chat';
import { CommonPingS2C, WorldTimeUpdateS2C } from '../../utils/Packets';
import { Guis } from '../../utils/player/Inventory';

let DungeonScanner;
let roomsField;

const RIGHT_CLICK_METHOD = mc.getClass().getDeclaredMethod('method_1583');
RIGHT_CLICK_METHOD.setAccessible(true);

class BloodBlink extends ModuleBase {
    constructor() {
        super({
            name: 'Blood Blink',
            subcategory: 'Other',
            description: 'Blinks to the Blood Room at the start of a dungeon (requires Devonian).',
            tooltip: 'Requires Devonian dungeon scanner. If Devonian is not installed, this module will not run.',
        });

        this.reflectionFailed = false;

        try {
            DungeonScanner = Java.type('com.github.synnerz.devonian.api.dungeon.DungeonScanner');
            roomsField = DungeonScanner.class.getDeclaredField('rooms');
            roomsField.setAccessible(true);
        } catch (e) {
            this.reflectionFailed = true;
        }

        this.blinkDelay = -1;
        this.outbounds = 0;
        this.blinkReady = false;
        this.dungeonStarted = true;

        this.pearlSlot = 1;
        this.aotvSlot = 1;

        this.on('tick', () => {
            this.pearlSlot = Guis.findItemInHotbar('Ender Pearl');
            this.aotvSlot = Guis.findItemInHotbar('Aspect of the Void') || Guis.findItemInHotbar('Aspect of the End');
            if (this.blinkDelay >= 0 && --this.blinkDelay <= 0) {
                this.blinkDelay = -1;
                Keybind.setKey('space', false);
                this.blink();
            }
        });

        register('command', () => {
            this.blink();
        }).setName('BloodBlink');

        this.on('packetReceived', (packet) => {
            this.outbounds = 40 - (packet.time() % 40);
        }).setFilteredClass(WorldTimeUpdateS2C);

        this.on('packetReceived', () => {
            if (this.outbounds == 0) this.outbounds = 40;
            else this.outbounds = this.outbounds - 1;
            if (!Utils.subArea().startsWith('The Catacombs')) return;
            if (this.dungeonStarted) return;
            if (this.outbounds == 21 && (Player.getY() == 71 || Player.getY() == 72)) this.setupBlink();
        }).setFilteredClass(CommonPingS2C);

        this.on('chat', (event) => {
            const msg = event.message.getUnformattedText();
            if (msg == 'Starting in 1 second.') this.blinkReady = true;
            if (
                msg ==
                'You are not allowed to use Potion Effects while in Dungeon, therefore all active effects have been paused and stored. They will be restored when you leave Dungeon!'
            ) {
                this.dungeonStarted = false;
                Client.scheduleTask(200, () => {
                    this.dungeonStarted = true;
                });
            }
        });
    }

    getBloodCenter() {
        if (this.reflectionFailed || !DungeonScanner || !roomsField) return null;
        const rooms = roomsField.get(DungeonScanner.INSTANCE);
        if (!rooms) return null;
        for (const room of rooms) {
            const name = room?.name?.toString ? room.name.toString() : room?.name;
            if (name && name.toLowerCase().includes('blood')) {
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
        const center = this.getBloodCenter();
        return center ? center.x : this.getOppositeCoord(Player.getX());
    }

    getBloodZ() {
        const center = this.getBloodCenter();
        return center ? center.z : this.getOppositeCoord(Player.getZ());
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

    blink() {
        if (this.reflectionFailed) {
            Chat.message('&c[Blood Blink] Failed to access Devonian DungeonScanner. Please install devonian or disable Blood Blink.');
            return;
        }

        const bloodCenter = this.getBloodCenter();
        const playerX = Player.getX();
        const playerY = Player.getY();
        const playerZ = Player.getZ();
        const bloodX = bloodCenter ? bloodCenter.x : this.getOppositeCoord(playerX);
        const bloodZ = bloodCenter ? bloodCenter.z : this.getOppositeCoord(playerZ);

        const closest = { x: -220, z: -220 };
        const distanceTo = (point) => Math.hypot(point.x - playerX, point.z - playerZ);

        const upTo210LeapsY = Math.round((200 - playerY) / 12);
        const toCornerLeapsX = Math.round((closest.x - playerX) / 12);
        const toCornerLeapsXDelta = Math.round((toCornerLeapsX - (closest.x - playerX) / 12) * 12);
        console.log(toCornerLeapsXDelta);
        const toCornerLeapsZ = Math.round((closest.z - playerZ) / 12);
        const toCornerLeapsZDelta = Math.round((toCornerLeapsZ - (closest.z - playerZ) / 12) * 12);
        console.log(toCornerLeapsZDelta);
        const downTo30LeapsY = Math.round(220 / 12);
        const toBloodLeapsX = Math.round((bloodX - closest.x - toCornerLeapsXDelta) / 12);
        const toBloodLeapsZ = Math.round((bloodZ - closest.z - toCornerLeapsZDelta) / 12);
        const directToBloodLeapsX = Math.round((bloodX - playerX) / 12);
        const directToBloodLeapsZ = Math.round((bloodZ - playerZ) / 12);
        const yawForX = (dx) => (dx >= 0 ? -90 : 90);
        const yawForZ = (dz) => (dz >= 0 ? 0 : 180);

        Rotations.rotateToAngles(0, -90);

        if (bloodCenter) {
            if (!this.blinkReady) return (this.blinkDelay = 20);
            this.blinkReady = false;
            Client.scheduleTask(0, () => {
                Rotations.rotateToAngles(Player.getYaw(), -90);
                this.repeatRightClick(upTo210LeapsY);
                Rotations.rotateToAngles(yawForX(closest.x - playerX), 0);
                this.repeatRightClick(toCornerLeapsX);
                Rotations.rotateToAngles(yawForZ(closest.z - playerZ), 0);
                this.repeatRightClick(toCornerLeapsZ);
                Rotations.rotateToAngles(0, 90);
                this.repeatRightClick(downTo30LeapsY);
                Rotations.rotateToAngles(yawForX(bloodX - closest.x), 0);
                this.repeatRightClick(toBloodLeapsX);
                Rotations.rotateToAngles(yawForZ(bloodZ - closest.z), 0);
                this.repeatRightClick(toBloodLeapsZ);
                Rotations.rotateToAngles(0, -90);
                this.repeatRightClick(10);
            });

            Client.scheduleTask(2, () => {
                Player.setHeldItemIndex(this.pearlSlot);
            });
            Client.scheduleTask(3, () => {
                this.rightClick();
            });
            Client.scheduleTask(4, () => {
                this.rightClick();
            });
            Client.scheduleTask(5, () => {
                this.rightClick();
            });
            Client.scheduleTask(6, () => {
                this.rightClick();
            });
            Client.scheduleTask(7, () => {
                this.rightClick();
            });
        } else {
            Client.scheduleTask(0, () => {
                Rotations.rotateToAngles(0, -90);
                this.repeatRightClick(upTo210LeapsY);
                Rotations.rotateToAngles(yawForX(bloodX - playerX), 0);
                this.repeatRightClick(directToBloodLeapsX);
                Rotations.rotateToAngles(yawForZ(bloodZ - playerZ), 0);
                this.repeatRightClick(directToBloodLeapsZ);
            });
        }
    }

    setupBlink() {
        if (this.reflectionFailed) {
            Chat.message('&c[Blood Blink] Failed to access Devonian DungeonScanner. Please install devonian or disable Blood Blink.');
            return;
        }
        if (Player.getY() >= 74) return (this.blinkDelay = 0); // standing on door method
        Client.scheduleTask(0, () => {
            Player.setHeldItemIndex(this.aotvSlot);
        });
        Client.scheduleTask(1, () => {
            Rotations.rotateToAngles(0, -90);
        });
        Client.scheduleTask(2, () => {
            this.rightClick();
            this.rightClick();
        });
        Client.scheduleTask(3, () => {
            Player.setHeldItemIndex(this.pearlSlot);
        });
        Client.scheduleTask(6, () => {
            this.rightClick();
        });
        Client.scheduleTask(8, () => {
            this.rightClick();
        });
        Client.scheduleTask(10, () => {
            this.rightClick();
        });
        Client.scheduleTask(12, () => {
            this.rightClick();
        });
        Client.scheduleTask(15, () => {
            this.rightClick();
        });
        Client.scheduleTask(18, () => {
            this.rightClick();
        });
        Client.scheduleTask(19, () => {
            Player.setHeldItemIndex(this.aotvSlot);
        });
        this.blinkDelay = 21;
    }
}

new BloodBlink();
