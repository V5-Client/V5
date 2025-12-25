import { Chat } from './Chat';
import { Notifications } from './Notifications';
import { ArrayLists, Vec3d, URL, BufferedInputStream, FileOutputStream } from './Constants';

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
        }).setName('polar', true);
    }

    /**
     * Checks if a specfic block coordinate has collision
     * @param {*} blockVec the Vec3d / x, y ,z
     * @returns wether the block has an empty collision shape
     */
    noCollision(blockVec) {
        const blockPosNMS = new net.minecraft.util.math.BlockPos(blockVec.x, blockVec.y, blockVec.z);
        const blockState = World.getWorld().getBlockState(blockPosNMS);
        const collisionShape = blockState.getCollisionShape(World.getWorld(), blockPosNMS);
        return collisionShape.isEmpty();
    }

    /**
     * Checks the players hitbox to see if its hitting anything
     * @returns if the player is collided
     */
    playerIsCollided() {
        const playerBox = Player.getPlayer().getBoundingBox();
        const expandedBox = playerBox.expand(0.01, 0, 0.01);

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

                    if (this.noCollision(blockVec)) return false;

                    return true;
                }
            }
        }

        return false;
    }

    // ik this is so ugly idgaf
    sidesOfCollision() {
        const player = Player.getPlayer();
        const playerBox = player.getBoundingBox();
        const expandedBox = playerBox.expand(0.01, 0.01, 0.01);

        // Normalize Yaw: 0=S, 90=W, 180=N, 270=E
        let yaw = ((player.getYaw() % 360) + 360) % 360;

        const world = { NORTH: false, SOUTH: false, WEST: false, EAST: false };

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
                    if (!block || block.type.getID() === 0) continue;
                    if (this.noCollision(new Vec3d(x, y, z))) continue;

                    if (Math.abs(playerBox.minX - (x + 1)) < 0.02) world.WEST = true;
                    if (Math.abs(playerBox.maxX - x) < 0.02) world.EAST = true;
                    if (Math.abs(playerBox.minZ - (z + 1)) < 0.02) world.NORTH = true;
                    if (Math.abs(playerBox.maxZ - z) < 0.02) world.SOUTH = true;
                }
            }
        }

        let res = { front: false, back: false, left: false, right: false };

        // Map world collisions to player-relative sides based on rotation
        if (yaw >= 315 || yaw < 45) {
            // Facing South (+Z)
            res.front = world.SOUTH;
            res.back = world.NORTH;
            res.left = world.EAST;
            res.right = world.WEST;
        } else if (yaw >= 45 && yaw < 135) {
            // Facing West (-X)
            res.front = world.WEST;
            res.back = world.EAST;
            res.left = world.SOUTH;
            res.right = world.NORTH;
        } else if (yaw >= 135 && yaw < 225) {
            // Facing North (-Z)
            res.front = world.NORTH;
            res.back = world.SOUTH;
            res.left = world.WEST;
            res.right = world.EAST;
        } else if (yaw >= 225 && yaw < 315) {
            // Facing East (+X)
            res.front = world.EAST;
            res.back = world.WEST;
            res.left = world.NORTH;
            res.right = world.SOUTH;
        }

        return res;
    }

    /**
     * @param {Object} input
     * @returns {Vec3d}
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
            Chat.message('Error parsing config file: ' + error);
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

    /**
     * Returns the subArea from the scoreboard
     * @returns {string} subArea
     */
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

    downloadFile(fileURL, savePath) {
        try {
            if (fileURL.startsWith('"') && fileURL.endsWith('"')) {
                fileURL = fileURL.substring(1, fileURL.length - 1);
            }

            let url = new URL(fileURL);
            let inStream = new BufferedInputStream(url.openStream());
            let outStream = new FileOutputStream(savePath);

            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
            let bytesRead;

            while ((bytesRead = inStream.read(buffer, 0, 1024)) !== -1) {
                outStream.write(buffer, 0, bytesRead);
            }

            inStream.close();
            outStream.close();
        } catch (e) {
            console.error(`Failed to download file from ${fileURL}: ${e}`);
            Chat.message(`&cFailed to download file: ${e}`);
        }
    }

    fakeBan(reason) {
        const Text = net.minecraft.text.Text;
        const Formatting = net.minecraft.util.Formatting;

        let banData = this.getConfigFile('bantime.json');
        let now = Date.now();
        const totalBanMs = 31103998277;

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
