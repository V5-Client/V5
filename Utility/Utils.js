//let { ModuleManager } = global.settingSelection;

import { Chat } from './Chat';
import { Notifications } from './Notifications';

import { ArrayLists, Vec3d } from './Constants';

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

                ChatLib.chat('§cYou were spawned into limbo.');
                ChatLib.command('limbo');
                Thread.sleep(50);
                ChatLib.chat('§cAn exception occured in your connection, so you have been routed to limbo!');
                ChatLib.chat('&b/limbo for more information');
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

        return; // this seems to be a bit fucked
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

    playerCords = () => {
        return {
            floor: [Math.floor(Player.getX()), Math.floor(Player.getY()), Math.floor(Player.getZ())],
            player: [Player.getX(), Player.getY(), Player.getZ()],
            beneath: [Math.floor(Player.getX()), Math.floor(Player.getY() - 1), Math.floor(Player.getZ())],
        };
    };

    noCollision(world, blockVec) {
        const blockPosNMS = new net.minecraft.util.math.BlockPos(blockVec.x, blockVec.y, blockVec.z);
        const blockState = world.getBlockState(blockPosNMS);
        const collisionShape = blockState.getCollisionShape(world, blockPosNMS);
        return collisionShape.isEmpty();
    }

    playerIsCollided() {
        const playerBox = Player.getPlayer().getBoundingBox();
        const expandedBox = playerBox.expand(0.01, 0, 0.01);

        const world = World.getWorld();

        let minX = Math.floor(expandedBox.minX);
        let minY = Math.floor(expandedBox.minY);
        let minZ = Math.floor(expandedBox.minZ);
        let maxX = Math.floor(expandedBox.maxX);
        let maxY = Math.floor(expandedBox.maxY);
        let maxZ = Math.floor(expandedBox.maxZ);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    let block = World.getBlockAt(x, y, z);

                    if (block?.type?.getID() === 0) return false;
                    const blockVec = new Vec3d(x, y, z);

                    if (this.noCollision(world, blockVec)) return false;

                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param {Object} input
     * @returns {vec}
     */
    convertToVector(input) {
        if (input && typeof input.x === 'number' && typeof input.y === 'number' && typeof input.z === 'number') return new Vec3d(input.x, input.y, input.z);
        if (input instanceof Player || input instanceof PlayerMP || input instanceof Entity) return new Vec3d(input.getX(), input.getY(), input.getZ());
        if (input instanceof BlockPos || input instanceof Vec3i) return new Vec3d(input.x, input.y, input.z);
        if (input instanceof Array && input.length >= 3) return new Vec3d(input[0], input[1], input[2]);
        if (input instanceof Vec3d) return input;

        return null;
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
