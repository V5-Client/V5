import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { manager } from '../../utils/SkyblockEvents';

const CHEST_BLOCK_IDS = new Set([54, 146]);
const CHEST_SEARCH_RADIUS = 3;
const RETURN_THRESHOLD = 2.0;
const RETURN_SPEED = 0.15;
const VECTOR_TOLERANCE = 0.05;
const TICK_INTERVAL_MS = 10;

const SEARCH_OFFSETS = (() => {
    const offsets = [];
    for (let dx = -CHEST_SEARCH_RADIUS; dx <= CHEST_SEARCH_RADIUS; dx++) {
        for (let dy = -CHEST_SEARCH_RADIUS; dy <= CHEST_SEARCH_RADIUS; dy++) {
            for (let dz = -CHEST_SEARCH_RADIUS; dz <= CHEST_SEARCH_RADIUS; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                offsets.push([dx, dy, dz, dx * dx + dy * dy + dz * dz]);
            }
        }
    }
    return offsets.sort((a, b) => a[3] - b[3]).map(([dx, dy, dz]) => [dx, dy, dz]);
})();

const State = Object.freeze({
    IDLE: 'idle',
    MINING: 'mining',
    CHEST: 'chest',
    RETURNING: 'returning',
});

class PowderMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Powder Macro',
            description: 'Powder Macro',
            subcategory: 'Mining',
            hideEnabledButton: true,
            isMacro: true,
        });

        this.bindToggleKey();
        this.initSettings();
        this.resetState();
        this.registerSkyblockEvents();

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.state,
                    'Target Chest': () => (this.targetChest ? 'Found' : 'Searching'),
                },
            },
        ]);
    }

    initSettings() {
        this.height = 8;
        this.width = 12;
        this.speed = 4;
        this.compression = 0.4;
        this.maxPitch = 75;

        this.addSlider('Height (Pitch)', 1, 30, 8, (v) => (this.height = v), 'Vertical size of the loop');
        this.addSlider('Width (Yaw)', 1, 30, 12, (v) => (this.width = v), 'Horizontal size of the loop');
        this.addSlider('Speed', 1, 20, 4, (v) => (this.speed = v), 'Speed of the loop');
        this.addSlider('Top Compression', 0.1, 1.0, 0.4, (v) => (this.compression = v), 'How much to compress the top half of the circle');
        this.addSlider('Max Pitch', 45, 90, 75, (v) => (this.maxPitch = v), 'Maximum pitch (look down angle) to prevent breaking floor');
    }

    resetState() {
        this.state = State.IDLE;
        this.pivot = { yaw: 0, pitch: 0 };
        this.startTime = 0;
        this.savedRotation = null;
        this.targetChest = null;
    }

    registerSkyblockEvents() {
        manager.subscribe('chestspawn', () => this.onChestSpawn());
        manager.subscribe('chestopen', () => this.onChestOpen());
    }

    onChestSpawn() {
        if (!this.enabled || this.state === State.CHEST) return;

        this.savedRotation = {
            yaw: Player.getYaw(),
            pitch: Player.getPitch(),
        };

        this.targetChest = null;
        this.setState(State.CHEST);
    }

    onChestOpen() {
        if (!this.enabled) return;

        this.targetChest = null;
        Rotations.stopRotation();

        if (!Keybind.isKeyDown('shift')) Keybind.setKey('shift', true);
        if (!Keybind.isKeyDown('leftclick')) Keybind.setKey('leftclick', true);

        this.setState(State.RETURNING);
    }

    setState(newState) {
        this.state = newState;
    }

    setMiningKeys(active) {
        Keybind.setKey('leftclick', active);
        Keybind.setKey('shift', active);
    }

    onEnable() {
        Keybind.setKey('leftclick', true);
        Keybind.setKey('shift', true);

        this.pivot = {
            yaw: Player.getYaw(),
            pitch: Player.getPitch(),
        };
        this.startTime = Date.now();

        Chat.message('Powder Macro Enabled!');

        this.setState(State.MINING);
        this.rotateLoop();
    }

    onDisable() {
        Keybind.setKey('leftclick', false);
        Keybind.setKey('shift', false);
        Rotations.stopRotation();
        this.resetState();

        Chat.message('Powder Macro Disabled!');
    }

    rotateLoop() {
        if (!this.enabled) return;

        try {
            switch (this.state) {
                case State.MINING:
                    this.tickMining();
                    break;
                case State.CHEST:
                    this.tickChest();
                    break;
                case State.RETURNING:
                    this.tickReturning();
                    break;
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        setTimeout(() => this.rotateLoop(), TICK_INTERVAL_MS);
    }

    tickMining() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const angle = elapsed * this.speed;

        let dPitch = Math.sin(angle) * this.height;
        if (dPitch < 0) dPitch *= this.compression;

        const targetYaw = this.pivot.yaw + Math.cos(angle) * this.width;
        const targetPitch = Math.min(this.pivot.pitch + dPitch, this.maxPitch);

        Rotations.applyRotationWithGCD(targetYaw, targetPitch);
    }

    tickChest() {
        Keybind.setKey('leftclick', false);
        Keybind.setKey('shift', false);

        if (!this.validateTargetChest()) {
            this.targetChest = this.findNearestChest();
        }

        if (this.targetChest) {
            this.rotateToTarget(this.getBlockCenter(this.targetChest));
        }
    }

    tickReturning() {
        const current = { yaw: Player.getYaw(), pitch: Player.getPitch() };
        const target = this.savedRotation ?? this.pivot;

        const diffYaw = Rotations.normalizeAngle(target.yaw - current.yaw);
        const diffPitch = target.pitch - current.pitch;
        const distance = Math.hypot(diffYaw, diffPitch);

        if (distance < RETURN_THRESHOLD) {
            this.syncLoopAngle(current);
            this.setState(State.MINING);
        } else {
            Rotations.applyRotationWithGCD(current.yaw + diffYaw * RETURN_SPEED, current.pitch + diffPitch * RETURN_SPEED);
        }
    }

    syncLoopAngle(currentRotation) {
        const dYaw = currentRotation.yaw - this.pivot.yaw;
        let dPitch = currentRotation.pitch - this.pivot.pitch;

        if (dPitch < 0 && this.compression !== 0) {
            dPitch /= this.compression;
        }

        const currentAngle = Math.atan2(dPitch / this.height, dYaw / this.width);
        this.startTime = Date.now() - (currentAngle / this.speed) * 1000;
    }

    validateTargetChest() {
        if (!this.targetChest) return false;

        const block = World.getBlockAt(this.targetChest.getX(), this.targetChest.getY(), this.targetChest.getZ());

        return this.isChestBlock(block);
    }

    findNearestChest() {
        const baseX = Math.floor(Player.getX());
        const baseY = Math.floor(Player.getY());
        const baseZ = Math.floor(Player.getZ());

        for (const [dx, dy, dz] of SEARCH_OFFSETS) {
            const block = World.getBlockAt(baseX + dx, baseY + dy, baseZ + dz);
            if (this.isChestBlock(block)) {
                return block;
            }
        }

        return null;
    }

    isChestBlock(block) {
        if (!block) return false;

        const blockType = block.getType();
        if (CHEST_BLOCK_IDS.has(blockType.getID())) return true;

        return blockType.getName().toLowerCase().includes('chest');
    }

    getBlockCenter(block) {
        return {
            x: block.getX() + 0.5,
            y: block.getY() + 0.5,
            z: block.getZ() + 0.5,
        };
    }

    rotateToTarget(target) {
        const current = Rotations.targetVector;
        const needsUpdate =
            !current ||
            Math.abs(current.x - target.x) > VECTOR_TOLERANCE ||
            Math.abs(current.y - target.y) > VECTOR_TOLERANCE ||
            Math.abs(current.z - target.z) > VECTOR_TOLERANCE;

        if (needsUpdate) {
            Rotations.rotateToVector(target);
        }
    }
}

new PowderMacro();
