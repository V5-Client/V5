//let { ModuleManager } = global.settingSelection;

import { Chat } from './Chat';
import { ItemObject } from './DataClasses/ItemObject';
import { Vector } from './DataClasses/Vec';
import { Notifications } from './Notifications';

import { ArrayLists, Vec3d } from './Constants';

let AxisAlignedBB = net.minecraft.world.phys.AABB;

// mc
export const mc = Client.getMinecraft();

class UtilsClass {
    constructor() {
        this.configName = 'V5Config';
        this.areaName = 'None';
        this.areaTime = 0;
        this.subAreaName = 'None';
        this.subAreaTime = 0;

        register('command', () => {
            new Thread(() => {
                function randomDelay() {
                    const seconds = Math.floor(Math.random() * 3) + 1;
                    return seconds * 1000;
                }

                Chat.message('§cYou were spawned into limbo.');
                Thread.sleep(50);
                ChatLib.command('limbo');
                Thread.sleep(30);
                Chat.message('§cAn exception occured in your connection, so you have been routed to limbo!');
                Thread.sleep(randomDelay());

                this.fakeBan(`You have been detected using the blacklisted modification "Polar Client"`);
            }).start();
        }).setName('polar');
    }

    /**
     * @param {Map} map
     */
    mapToArray(map) {
        let array = [];
        map.forEach((element) => {
            array.push(element);
        });
        return array;
    }

    makeJavaArray(array) {
        let JavaArray = new ArrayLists();
        for (let i = 0; i < array.length; i++) {
            JavaArray.add(array[i]);
        }
        return JavaArray;
    }

    makeRandomPitch(min, max) {
        this.randomPitch = Math.random() * (max - min) + min;
    }

    getRandomPitch() {
        return this.randomPitch;
    }

    /**
     * Warn the player
     */
    /**
     * Warns the player with a message and an optional audio notification.
     * @param {string} [msg="New Alert!"] - The message to display to the player.
     */
    warnPlayer = (msg = 'New Alert!') => {
        // TODO RC Alert

        Notifications.sendAlert(msg);

        if (!ModuleManager.getSetting('Failsafes', 'Audio Notifications')) return;

        // Failsafe Sound
        try {
            let audio = new Sound({
                source: global.export.FailsafeManager.getAudioSource()?.toString(),
            });
            Chat.message('New Alert! ' + msg);
            audio.setVolume(1);
            audio.play();
        } catch (e) {
            Chat.message('&cFailsafe sound assets missing! Try reinstall rdbt client!');
        }
    };

    getRandomInRange(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    sendPacket(Packet) {
        Client.getMinecraft().client.getNetworkHandler().sendPacket(Packet);
    }

    // Item Utils

    /**
     * @param {String} name
     * @returns {itemObject}
     */
    getItemByName(name) {
        for (let i = 0; i <= 8; i++) {
            let item = Player.getInventory()?.getStackInSlot(i);
            if (item && ChatLib.removeFormatting(item.getName()).includes(name)) {
                return new ItemObject(item, i);
            }
        }
        return null;
    }
    /**
     * @param {Array<String>} lore
     * @param {String} string
     */
    includesLore(lore, string) {
        for (let i = 0; i < lore.length; i++) {
            if (ChatLib.removeFormatting(lore[i]).includes(string)) return true;
        }
    }

    /**
     * Returns an item index filtered by the unformatted name
     * @param {String[]} Name
     * @returns {itemHelper}
     */
    findItem(Names) {
        for (let i = 0; i < Names.length; i++) {
            for (let f = 0; f <= 8; f++) {
                let item = Player.getInventory()?.getStackInSlot(f);
                if (item && ChatLib.removeFormatting(item.getName()).includes(Names[i])) {
                    return new ItemObject(item, f);
                }
            }
        }
        return null;
    }

    getItem = (Slot) => {
        let item = Player.getInventory()?.getStackInSlot(Slot);
        return new ItemObject(item, Slot);
    };

    /**
     * @param {String} ModuleName
     * @param {String[][]} Items
     * @returns {Boolean}
     * checks if all input items are in the hotbar
     */
    checkItems = (ModuleName, Items) => {
        let Missing = [];
        for (let i = 0; i < Items.length; i++) {
            if (this.findItem(Items[i]) === null) {
                Missing.push(Items[i]);
            }
        }
        if (Missing.length > 0) {
            for (let i = 0; i < Missing.length; i++) {
                Chat.message('- Missing: ' + Missing[i].toString());
            }
            return false;
        }
        return true;
    };

    playerCords = () => {
        return {
            floor: [Math.floor(Player.getX()), Math.floor(Player.getY()), Math.floor(Player.getZ())],
            player: [Player.getX(), Player.getY(), Player.getZ()],
            beneath: [Math.floor(Player.getX()), Math.floor(Player.getY() - 1), Math.floor(Player.getZ())],
        };
    };

    playerIsCollided() {
        const playerBB = Player.getPlayer().getBoundingBox();
        const blocks = this.getBlocks();
        return blocks.some((block) => block.intersects(playerBB));
    }

    getBlocks() {
        let cords = [Math.floor(Player.getX()), Math.floor(Player.getY()), Math.floor(Player.getZ())];
        let boxes = [];
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                for (let y = 0; y <= 1; y++) {
                    let ctBlock = World.getBlockAt(cords[0] + x, cords[1] + y, cords[2] + z);
                    if (ctBlock.type.mcBlock.func_149669_A() != 1.0 || ctBlock.type.getID() === 0) continue;
                    boxes.push(
                        new AxisAlignedBB(
                            cords[0] + x - 0.01,
                            cords[1] + y,
                            cords[2] + z - 0.01,
                            cords[0] + x + 1.01,
                            cords[1] + y + ctBlock.type.mcBlock.func_149669_A(),
                            cords[2] + z + 1.01
                        )
                    );
                }
            }
        }
        return boxes;
    }

    /**
     * @param {Object} input
     * @returns {vec}
     */
    convertToVector(input) {
        if (input instanceof Vector || input instanceof Vec3d) return input;
        if (input instanceof Array && input.length >= 3) return new Vector(input[0], input[1], input[2]);
        else if (input instanceof BlockPos || input instanceof Vec3i) return new Vector(input.x, input.y, input.z);
        else if (input instanceof net.minecraft.util.math.Vec3d) return new Vector(input.x, input.y, input.z);
        else if (input instanceof Player || input instanceof PlayerMP || input instanceof Entity) return new Vector(input.getX(), input.getY(), input.getZ());
        else if (input && typeof input.x === 'number' && typeof input.y === 'number' && typeof input.z === 'number')
            return new Vector(input.x, input.y, input.z);

        return null;
    }

    isNumber(object) {
        return typeof object === 'number';
    }

    /**
     * Reads and parses a JSON configuration file.
     * @param {string} Name - The name of the configuration file (e.g., "webhook.json").
     * @returns {object} The parsed JSON object from the file.
     */

    getConfigFile(Name) {
        let content = FileLib.read(this.configName, Name);
        if (!content) return {};
        try {
            let parse = JSON.parse(content);
            return parse;
        } catch (error) {
            Chat.message('Error parsing route file: ' + error);
            return {};
        }
    }

    /**
     * Writes a JavaScript object to a JSON configuration file.
     * @param {string} Name - The name of the configuration file.
     * @param {object} Value - The object to write to the file.
     */
    writeConfigFile(Name, Value) {
        let string = JSON.stringify(Value, null, 2);
        FileLib.write(this.configName, Name, string);
    }

    blockCode(pos) {
        return pos.x + '' + pos.y + '' + pos.z;
    }

    /**
     * Returns the area from the tab list
     * @returns {string} area
     */
    area() {
        if (this.areaTime < Date.now() - 1000) {
            let areaLine = TabList.getNames().find((name) => {
                let str = String(name);
                return str.indexOf('Area:') !== -1;
            });

            if (areaLine) {
                let clean = String(areaLine).replace(/§[0-9A-FK-OR]/gi, '');
                let areaName = clean.split('Area:')[1].trim();
                this.areaName = areaName;
                this.areaTime = Date.now();
            }
        }
        return this.areaName;
    }

    subArea() {
        if (this.subAreaTime < Date.now() - 1000) {
            let lines = Scoreboard.getLines();

            for (let i = 0; i < lines.length; i++) {
                let str = String(lines[i]);

                if (str.indexOf('⏣') !== -1) {
                    let clean = str.replace(/§[0-9A-FK-OR]/gi, '');
                    let subAreaName = clean.split('⏣')[1].trim();

                    this.subAreaName = subAreaName;
                    this.subAreaTime = Date.now();
                }
            }
        }
        return this.subAreaName;
    }

    fakeBan(reason) {
        const Text = net.minecraft.text.Text;
        const Formatting = net.minecraft.util.Formatting;

        let banData = this.getConfigFile('bantime.json');
        let now = Date.now();
        const totalBanMs = 31103998277; // 360 * 24 * 60 * 60 * 1000: 360 days but i removed 1759 or smth so its like 359 cuz thats what real ones do

        if (!banData.start) {
            banData.start = now;
            this.writeConfigFile('bantime.json', banData);
        }

        let elapsed = now - banData.start;
        let remaining = Math.max(totalBanMs - elapsed, 0);

        function formatTime(ms) {
            let totalSec = Math.floor(ms / 1000);
            let days = Math.floor(totalSec / 86400);
            let hours = Math.floor((totalSec % 86400) / 3600);
            let mins = Math.floor((totalSec % 3600) / 60);
            let secs = totalSec % 60;

            return `${days}d ${hours}h ${mins}m ${secs}s`;
        }

        let banTimeStr = formatTime(remaining);

        let handler = Client.getMinecraft().getNetworkHandler();
        if (!handler) {
            global.showNotification('fakeBan failed', 'No network handler available', 'ERROR');
            return;
        }

        let banMessage = Text.literal('You are temporarily banned for ')
            .formatted(Formatting.RED)
            .append(Text.literal(banTimeStr).formatted(Formatting.WHITE))
            .append(Text.literal(' from this server!\n\n').formatted(Formatting.RED))
            .append(Text.literal('Reason: ').formatted(Formatting.GRAY))
            .append(Text.literal(reason + '\n').formatted(Formatting.WHITE))
            .append(Text.literal('Find out more: ').formatted(Formatting.GRAY))
            .append(Text.literal('https://www.hypixel.net/appeal\n\n').formatted(Formatting.AQUA, Formatting.UNDERLINE))
            .append(Text.literal('Ban ID: ').formatted(Formatting.GRAY))
            .append(Text.literal('#' + this.makeId() + '\n').formatted(Formatting.WHITE))
            .append(Text.literal('Sharing your Ban ID may affect the processing of your appeal!').formatted(Formatting.GRAY));

        handler.getConnection().disconnect(banMessage);
    }

    makeId() {
        const chars = 'ABCDEF0123456789';
        let result = '793';
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

export const Utils = new UtilsClass();
