import { Chat } from './Chat';
import { BP, isLinux, isMac, isWindows, Vec3d } from './Constants';
import { GameMessageS2C } from './Packets';
import { TabListUtils } from './TabListUtils';

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
            this.cache.set(fileName, { data: data, timestamp: Date.now() });
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
        this.currentSubArea = 'Unknown';
        this.subAreaLastChecked = 0;
    }

    getArea() {
        return TabListUtils.getArea();
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

    getLobbyDay() {
        const world = Client.getMinecraft()?.world;
        if (!world) return 0;
        return Math.floor(world.getTimeOfDay() / 24000);
    }

    stripFormatting(text) {
        if (text == null) return '';
        return text.replace(/§[0-9A-FK-OR]/gi, '');
    }

    reset() {
        this.currentSubArea = 'Unknown';
        this.subAreaLastChecked = 0;
        TabListUtils.resetAreaCache();
    }
}

class ManaDetector {
    constructor() {
        this.currentMana = null;
        this.manaPatternWithColors = /(?:\u00A7b)?([\d,]+)\/([\d,]+)\u270E\s*(?:Mana|(?:\u00A73)?([\d,]+)\u02AC)\s*/;
        this.manaPattern = /([\d,]+)\/([\d,]+)\u270E\s*(?:Mana|([\d,]+)\u02AC)\s*/;

        register('worldLoad', () => this.reset());
        register('packetReceived', (packet) => {
            this.onGameMessage(packet);
        }).setFilteredClass(GameMessageS2C);
    }

    onGameMessage(packet) {
        if (!packet || !packet.overlay || !packet.overlay()) return;

        const content = packet.content();
        const actionBar = content?.getString();
        if (!actionBar) return;

        let match = actionBar.match(this.manaPatternWithColors);

        if (!match) {
            const stripped = actionBar.replace(/\u00A7[0-9A-FK-ORa-fk-or]/g, '');
            match = stripped.match(this.manaPattern);
        }
        if (!match) return;

        this.currentMana = Number(match[1]);
    }

    getCurrentMana() {
        return this.currentMana;
    }

    reset() {
        this.currentMana = null;
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

                        if (!block || !block.type || block.type.getID() === 0) continue;

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
            const world = World.getWorld();
            if (!world) return false;

            let blockPos = new BP(x, y, z);
            let blockState = world.getBlockState(blockPos);
            if (!blockState) return false;

            let shape = blockState.getCollisionShape(world, blockPos);
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

        if (this.hasXYZ(input)) {
            return new Vec3d(input.x, input.y, input.z);
        }

        if (Array.isArray(input) && input.length >= 3) {
            return new Vec3d(input[0], input[1], input[2]);
        }

        if (this.hasPositionMethods(input)) {
            return new Vec3d(input.getX(), input.getY(), input.getZ());
        }

        return null;
    }

    hasXYZ(obj) {
        return obj && typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number';
    }

    hasPositionMethods(obj) {
        return obj && typeof obj.getX === 'function' && typeof obj.getY === 'function' && typeof obj.getZ === 'function';
    }
}

let configManager = new ConfigFileManager(CONFIG_DIR_NAME);
let locationDetector = new LocationDetector();
let collisionChecker = new CollisionChecker();
let vectorConverter = new VectorConverter();
let manaDetector = new ManaDetector();

class UtilsClass {
    constructor() {
        this.configName = CONFIG_DIR_NAME;
    }

    noCollision(blockVec) {
        const world = World.getWorld();
        if (!blockVec || !world) return false;
        const blockPosNMS = new BP(blockVec.x, blockVec.y, blockVec.z);
        const blockState = world.getBlockState(blockPosNMS);
        if (!blockState) return false;
        const collisionShape = blockState.getCollisionShape(world, blockPosNMS);
        return collisionShape.isEmpty();
    }

    playerIsCollided(ignoreBottomSlab) {
        const shouldIgnoreBottomSlab = !!ignoreBottomSlab;
        const player = Player.getPlayer();
        const world = World.getWorld();
        if (!player || !world) return false;

        const playerBox = player.getBoundingBox();
        // Use a small epsilon to avoid "ghost" collisions with adjacent blocks
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

                    if (!block || !block.type || block.type.getID() === 0) continue;

                    const blockPosNMS = new BP(x, y, z);
                    const blockState = world.getBlockState(blockPosNMS);
                    const registryName = block.type.getRegistryName()?.toLowerCase?.();

                    if (!registryName || !blockState) continue;

                    if (registryName.includes('carpet')) continue;

                    if (shouldIgnoreBottomSlab) {
                        if (registryName.includes('farmland')) continue;

                        if (registryName.includes('slab')) {
                            const stateString = blockState.toString();
                            if (stateString.includes('type=bottom')) continue;
                        }
                    }

                    const collisionShape = blockState.getCollisionShape(world, blockPosNMS);
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
        const mcWorld = World.getWorld();
        if (!player || !mcWorld) return { front: false, back: false, left: false, right: false };

        const playerBox = player.getBoundingBox();
        const expandedBox = playerBox.expand(0.01, 0.01, 0.01);

        let yaw = ((player.getYaw() % 360) + 360) % 360;
        const collisionSides = { NORTH: false, SOUTH: false, WEST: false, EAST: false };

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
                    if (!block || !block.type || block.type.getID() === 0) continue;

                    let blockPos = new BP(x, y, z);
                    let blockState = mcWorld.getBlockState(blockPos);
                    if (!blockState) continue;
                    let voxelShape = blockState.getCollisionShape(mcWorld, blockPos);

                    if (!voxelShape || voxelShape.isEmpty()) continue;

                    let collisionBoxes = voxelShape.getBoundingBoxes();

                    for (let i = 0; i < collisionBoxes.size(); i++) {
                        let blockBox = collisionBoxes.get(i).offset(x, y, z);

                        if (expandedBox.intersects(blockBox)) {
                            if (blockBox.maxX <= playerBox.minX + 0.05) collisionSides.WEST = true;
                            if (blockBox.minX >= playerBox.maxX - 0.05) collisionSides.EAST = true;
                            if (blockBox.maxZ <= playerBox.minZ + 0.05) collisionSides.NORTH = true;
                            if (blockBox.minZ >= playerBox.maxZ - 0.05) collisionSides.SOUTH = true;
                        }
                    }
                }
            }
        }

        let res = { front: false, back: false, left: false, right: false };

        if (yaw >= 315 || yaw < 45) {
            res.front = collisionSides.SOUTH;
            res.back = collisionSides.NORTH;
            res.left = collisionSides.EAST;
            res.right = collisionSides.WEST;
        } else if (yaw >= 45 && yaw < 135) {
            res.front = collisionSides.WEST;
            res.back = collisionSides.EAST;
            res.left = collisionSides.SOUTH;
            res.right = collisionSides.NORTH;
        } else if (yaw >= 135 && yaw < 225) {
            res.front = collisionSides.NORTH;
            res.back = collisionSides.SOUTH;
            res.left = collisionSides.WEST;
            res.right = collisionSides.EAST;
        } else if (yaw >= 225 && yaw < 315) {
            res.front = collisionSides.EAST;
            res.back = collisionSides.WEST;
            res.left = collisionSides.NORTH;
            res.right = collisionSides.SOUTH;
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
        if (fileName === 'config.json') {
            return configManager.readWithCache(fileName, 200);
        }
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

    getDay() {
        return locationDetector.getLobbyDay();
    }

    resetLocationCache() {
        locationDetector.reset();
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
        return Math.hypot(dx, dy, dz);
    }

    distance2D(x1, z1, x2, z2) {
        let dx = x2 - x1;
        let dz = z2 - z1;
        return Math.hypot(dx, dz);
    }

    openBrowser(url) {
        const t = new java.lang.Thread(() => {
            try {
                if (isMac) {
                    java.lang.Runtime.getRuntime().exec(['open', url]);
                    return;
                }

                try {
                    if (java.awt.Desktop.isDesktopSupported() && java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.BROWSE)) {
                        java.awt.Desktop.getDesktop().browse(new java.net.URI(url));
                        return;
                    }
                } catch (e) {}

                if (isWindows) {
                    java.lang.Runtime.getRuntime().exec(['rundll32', 'url.dll,FileProtocolHandler', url]);
                } else if (isLinux) {
                    java.lang.Runtime.getRuntime().exec(['xdg-open', url]);
                }
            } catch (e) {
                console.error('V5 Caught error in openBrowser: ' + e + e.stack);
            }
        });
        t.setDaemon(true);
        t.start();
    }

    hasCookie() {
        return TabListUtils.hasCookie();
    }

    getCurrentMana() {
        return manaDetector.getCurrentMana();
    }

    checkPlayerCollision() {
        return collisionChecker.checkPlayerCollision();
    }
}

export const Utils = new UtilsClass();
