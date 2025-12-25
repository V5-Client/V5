import { Chat } from './Chat';
import { Notifications } from './Notifications';
import { ArrayLists, Vec3d, URL, BufferedInputStream, FileOutputStream } from './Constants';

export const mc = Client.getMinecraft();

export const CONFIG_DIR_NAME = 'V5Config';
export const CACHE_DURATION_MS = 1000;
export const AREA_CACHE_SHORT_MS = 50;

class ConfigFileManager {
    constructor(dirName) {
        this.directory = dirName;
        this.cache = new Map();
    }

    read(fileName) {
        let rawContent = FileLib.read(this.directory, fileName);
        if (!rawContent || rawContent.trim() === '') {
            return {};
        }

        try {
            return JSON.parse(rawContent);
        } catch (parseError) {
            Chat.message('Config read error for ' + fileName + ': ' + parseError.message);
            return {};
        }
    }

    write(fileName, data) {
        try {
            let jsonString = JSON.stringify(data, null, 2);
            FileLib.write(this.directory, fileName, jsonString);
            this.cache.set(fileName, data);
            return true;
        } catch (writeError) {
            Chat.message('Config write error for ' + fileName + ': ' + writeError.message);
            return false;
        }
    }

    readWithCache(fileName, ttl) {
        ttl = ttl || 5000;
        let cached = this.cache.get(fileName);

        if (cached && cached.timestamp && Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }

        let data = this.read(fileName);
        this.cache.set(fileName, { data: data, timestamp: Date.now() });
        return data;
    }

    clearCache(fileName) {
        if (fileName) {
            this.cache.delete(fileName);
        } else {
            this.cache.clear();
        }
    }
}

class LocationDetector {
    constructor() {
        this.currentArea = 'Unknown';
        this.currentSubArea = 'Unknown';
        this.areaLastChecked = 0;
        this.subAreaLastChecked = 0;
    }

    getArea() {
        let now = Date.now();

        if (now - this.areaLastChecked < AREA_CACHE_SHORT_MS) {
            return this.currentArea;
        }

        this.areaLastChecked = now;

        try {
            let tabLines = TabList.getNames();
            if (!tabLines) return this.currentArea;

            for (var i = 0; i < tabLines.length; i++) {
                let lineStr = String(tabLines[i]);
                let cleanLine = this.stripFormatting(lineStr);

                if (cleanLine.indexOf('Area:') !== -1) {
                    let parts = cleanLine.split('Area:');
                    if (parts.length > 1) {
                        this.currentArea = parts[1].trim();
                        return this.currentArea;
                    }
                }
            }
        } catch (err) {
            return this.currentArea;
        }

        return this.currentArea;
    }

    getSubArea() {
        let now = Date.now();

        if (now - this.subAreaLastChecked < CACHE_DURATION_MS) {
            return this.currentSubArea;
        }

        this.subAreaLastChecked = now;

        try {
            let scoreLines = Scoreboard.getLines();
            if (!scoreLines) return this.currentSubArea;

            for (var i = 0; i < scoreLines.length; i++) {
                let lineStr = String(scoreLines[i]);

                if (lineStr.indexOf('⏣') !== -1) {
                    let cleaned = this.stripFormatting(lineStr);
                    let segments = cleaned.split('⏣');

                    if (segments.length > 1) {
                        this.currentSubArea = segments[1].trim();
                        return this.currentSubArea;
                    }
                }
            }
        } catch (err) {
            return this.currentSubArea;
        }

        return this.currentSubArea;
    }

    stripFormatting(text) {
        return text.replace(/§[0-9A-FK-OR]/gi, '');
    }

    reset() {
        this.currentArea = 'Unknown';
        this.currentSubArea = 'Unknown';
        this.areaLastChecked = 0;
        this.subAreaLastChecked = 0;
    }
}

class CollisionChecker {
    checkPlayerCollision() {
        try {
            let player = Player.getPlayer();
            if (!player) return false;

            let bbox = player.getBoundingBox();
            let expanded = bbox.expand(0.01, 0, 0.01);

            let xMin = Math.floor(expanded.minX);
            let yMin = Math.floor(expanded.minY);
            let zMin = Math.floor(expanded.minZ);
            let xMax = Math.floor(expanded.maxX);
            let yMax = Math.floor(expanded.maxY);
            let zMax = Math.floor(expanded.maxZ);

            for (var x = xMin; x <= xMax; x++) {
                for (var y = yMin; y <= yMax; y++) {
                    for (var z = zMin; z <= zMax; z++) {
                        let block = World.getBlockAt(x, y, z);

                        if (!block || !block.type || block.type.getID() === 0) {
                            return false;
                        }

                        if (this.hasCollision(x, y, z)) {
                            return true;
                        }
                    }
                }
            }

            return false;
        } catch (err) {
            return false;
        }
    }

    hasCollision(x, y, z) {
        try {
            let blockPos = new net.minecraft.util.math.BlockPos(x, y, z);
            let blockState = World.getWorld().getBlockState(blockPos);
            let shape = blockState.getCollisionShape(blockPos);
            return !shape.isEmpty();
        } catch (err) {
            return false;
        }
    }
}

class VectorConverter {
    convert(input) {
        if (!input) return null;

        if (input instanceof Vec3d) {
            return input;
        }

        if (this.hasXYZ(input)) {
            return new Vec3d(input.x, input.y, input.z);
        }

        if (input instanceof Array && input.length >= 3) {
            return new Vec3d(input[0], input[1], input[2]);
        }

        if (input instanceof Player || input instanceof PlayerMP || input instanceof Entity) {
            return new Vec3d(input.getX(), input.getY(), input.getZ());
        }

        if (input instanceof BlockPos || input instanceof Vec3i) {
            return new Vec3d(input.x, input.y, input.z);
        }

        return null;
    }

    hasXYZ(obj) {
        return obj && typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number';
    }
}

class FileDownloader {
    download(urlString, destination) {
        new Thread(function () {
            try {
                if (urlString.startsWith('"') && urlString.endsWith('"')) {
                    urlString = urlString.substring(1, urlString.length - 1);
                }
                let url = new URL(urlString);
                let inputStream = new BufferedInputStream(url.openStream());
                let outputStream = new FileOutputStream(destination);
                let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
                let bytesRead;
                while ((bytesRead = inputStream.read(buffer, 0, 1024)) !== -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                inputStream.close();
                outputStream.close();
            } catch (error) {
                Chat.message('Download failed: ' + error);
            }
        }).start();
    }
}

class BanSimulator {
    constructor(configManager) {
        this.configManager = configManager;
        this.banDurationMs = 31103998277;
    }

    trigger(reason) {
        try {
            let Text = net.minecraft.text.Text;
            let Formatting = net.minecraft.util.Formatting;

            let banRecord = this.configManager.read('bantime.json');
            let currentTime = Date.now();

            if (!banRecord.start) {
                banRecord.start = currentTime;
                this.configManager.write('bantime.json', banRecord);
            }

            let elapsed = currentTime - banRecord.start;
            let remaining = Math.max(this.banDurationMs - elapsed, 0);
            let timeString = this.formatDuration(remaining);

            let networkHandler = Client.getMinecraft().getNetworkHandler();
            if (!networkHandler) {
                Chat.message('Network handler unavailable');
                return;
            }

            let banId = this.generateBanId();

            let message = Text.literal('You are temporarily banned for ')
                .formatted(Formatting.RED)
                .append(Text.literal(timeString).formatted(Formatting.WHITE))
                .append(Text.literal(' from this server!\\n\\n').formatted(Formatting.RED))
                .append(Text.literal('Reason: ').formatted(Formatting.GRAY))
                .append(Text.literal(reason + '\\n').formatted(Formatting.WHITE))
                .append(Text.literal('Find out more: ').formatted(Formatting.GRAY))
                .append(Text.literal('https://www.hypixel.net/appeal\\n\\n').formatted(Formatting.AQUA, Formatting.UNDERLINE))
                .append(Text.literal('Ban ID: ').formatted(Formatting.GRAY))
                .append(Text.literal('#' + banId + '\\n').formatted(Formatting.WHITE))
                .append(Text.literal('Sharing your Ban ID may affect the processing of your appeal!').formatted(Formatting.GRAY));

            networkHandler.getConnection().disconnect(message);
        } catch (err) {
            Chat.message('Ban simulation error: ' + err);
        }
    }

    formatDuration(milliseconds) {
        let totalSeconds = Math.floor(milliseconds / 1000);
        let days = Math.floor(totalSeconds / 86400);
        let hours = Math.floor((totalSeconds % 86400) / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;

        return days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
    }

    generateBanId() {
        let characters = 'ABCDEF0123456789';
        let id = '793';

        for (var i = 0; i < 5; i++) {
            let randomIndex = Math.floor(Math.random() * characters.length);
            id = id + characters.charAt(randomIndex);
        }

        return id;
    }
}

let configManager = new ConfigFileManager(CONFIG_DIR_NAME);
let locationDetector = new LocationDetector();
let collisionChecker = new CollisionChecker();
let vectorConverter = new VectorConverter();
let fileDownloader = new FileDownloader();
let banSimulator = new BanSimulator(configManager);

register('command', function () {
    new Thread(function () {
        function randomDelay() {
            let seconds = Math.floor(Math.random() * 3) + 1;
            return seconds * 1000;
        }

        ChatLib.chat('§cYou were spawned into limbo.');
        ChatLib.command('limbo');
        Thread.sleep(50);
        ChatLib.chat('§cAn exception occured in your connection, so you have been routed to limbo!');
        ChatLib.chat('&b/limbo for more information');
        Thread.sleep(randomDelay());

        banSimulator.trigger('You have been detected using the blacklisted modification "Polar Client"');
    }).start();
}).setName('polar', true);

class UtilsClass {
    constructor() {
        this.configName = CONFIG_DIR_NAME;
    }

    noCollision(blockVec) {
        return !collisionChecker.hasCollision(blockVec.x, blockVec.y, blockVec.z);
    }

    playerIsCollided() {
        return collisionChecker.checkPlayerCollision();
    }

    convertToVector(input) {
        return vectorConverter.convert(input);
    }

    getConfigFile(fileName) {
        return configManager.read(fileName);
    }

    writeConfigFile(fileName, data) {
        return configManager.write(fileName, data);
    }

    getConfigFileCached(fileName, ttl) {
        return configManager.readWithCache(fileName, ttl);
    }

    clearConfigCache(fileName) {
        configManager.clearCache(fileName);
    }

    area() {
        return locationDetector.getArea();
    }

    subArea() {
        return locationDetector.getSubArea();
    }

    resetLocationCache() {
        locationDetector.reset();
    }

    downloadFile(url, destination) {
        return fileDownloader.download(url, destination);
    }

    fakeBan(reason) {
        banSimulator.trigger(reason);
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    isPointInBox(point, boxMin, boxMax) {
        return point.x >= boxMin.x && point.x <= boxMax.x && point.y >= boxMin.y && point.y <= boxMax.y && point.z >= boxMin.z && point.z <= boxMax.z;
    }

    distance3D(x1, y1, z1, x2, y2, z2) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let dz = z2 - z1;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    distance2D(x1, z1, x2, z2) {
        let dx = x2 - x1;
        let dz = z2 - z1;
        return Math.sqrt(dx * dx + dz * dz);
    }

    makeId() {
        return banSimulator.generateBanId();
    }
}

export const Utils = new UtilsClass();
