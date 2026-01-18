import { Chat } from './Chat';
import { Vec3d, URL, BufferedInputStream, FileOutputStream, BP, isWindows, isMac, isLinux } from './Constants';

export const mc = Client.getMinecraft();

export const CONFIG_DIR_NAME = 'V5Config';
export const CACHE_DURATION_MS = 1000;

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
        } catch (e) {
            Chat.message('Config read error for ' + fileName + ': ' + e.message);
            console.error('V5 Caught error' + e + e.stack);

            return {};
        }
    }

    write(fileName, data) {
        try {
            let jsonString = JSON.stringify(data, null, 2);
            FileLib.write(this.directory, fileName, jsonString);
            this.cache.set(fileName, data);
            return true;
        } catch (e) {
            Chat.message('Config write error for ' + fileName + ': ' + e.message);
            console.error('V5 Caught error' + e + e.stack);
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

        if (now - this.areaLastChecked < CACHE_DURATION_MS) {
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
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
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
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
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
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return false;
        }
    }

    hasCollision(x, y, z) {
        try {
            let blockPos = new BP(x, y, z);
            let blockState = World.getWorld().getBlockState(blockPos);
            let shape = blockState.getCollisionShape(blockPos);
            return !shape.isEmpty();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
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
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
                Chat.message('Download failed: ' + e);
            }
        }).start();
    }
}

let configManager = new ConfigFileManager(CONFIG_DIR_NAME);
let locationDetector = new LocationDetector();
let collisionChecker = new CollisionChecker();
let vectorConverter = new VectorConverter();
let fileDownloader = new FileDownloader();

class UtilsClass {
    constructor() {
        this.configName = CONFIG_DIR_NAME;
    }

    noCollision(blockVec) {
        const blockPosNMS = new BP(blockVec.x, blockVec.y, blockVec.z);
        const blockState = World.getWorld().getBlockState(blockPosNMS);
        const collisionShape = blockState.getCollisionShape(World.getWorld(), blockPosNMS);
        return collisionShape.isEmpty();
    }

    playerIsCollided(ignoreBottomSlab) {
        const shouldIgnoreBottomSlab = !!ignoreBottomSlab;
        const playerBox = Player.getPlayer().getBoundingBox();
        // Use a small epsilon to avoid "ghost" collisions with adjacent blocks
        const expandedBox = playerBox.expand(0.01, 0.0, 0.01);

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

                    const blockPosNMS = new BP(x, y, z);
                    const blockState = World.getWorld().getBlockState(blockPosNMS);
                    const registryName = block.type.getRegistryName().toLowerCase();

                    if (registryName.includes('carpet')) continue;

                    if (shouldIgnoreBottomSlab) {
                        if (registryName.includes('slab')) {
                            const stateString = blockState.toString();
                            if (stateString.includes('type=bottom')) continue;
                        }
                    }

                    const collisionShape = blockState.getCollisionShape(World.getWorld(), blockPosNMS);
                    if (collisionShape.isEmpty()) continue;

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

        if (yaw >= 315 || yaw < 45) {
            res.front = world.SOUTH;
            res.back = world.NORTH;
            res.left = world.EAST;
            res.right = world.WEST;
        } else if (yaw >= 45 && yaw < 135) {
            res.front = world.WEST;
            res.back = world.EAST;
            res.left = world.SOUTH;
            res.right = world.NORTH;
        } else if (yaw >= 135 && yaw < 225) {
            res.front = world.NORTH;
            res.back = world.SOUTH;
            res.left = world.WEST;
            res.right = world.EAST;
        } else if (yaw >= 225 && yaw < 315) {
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

    openBrowser(url) {
        try {
            java.awt.Desktop.getDesktop().browse(new java.net.URI(url));
        } catch (e) {
            console.error('Failed to open browser (1) (ignore this error): ');
            console.error('V5 Caught error' + e + e.stack);
            try {
                if (isWindows) {
                    java.lang.Runtime.getRuntime().exec('rundll32 url.dll,FileProtocolHandler ' + url);
                } else if (isMac) {
                    java.lang.Runtime.getRuntime().exec('open ' + url);
                } else if (isLinux) {
                    java.lang.Runtime.getRuntime().exec('xdg-open ' + url);
                }
            } catch (e) {
                console.error('Failed to open browser (2): ');
                console.error('V5 Caught error' + e + e.stack);
            }
        }
    }
}

export const Utils = new UtilsClass();
