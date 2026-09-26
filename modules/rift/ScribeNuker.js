import { Vec3d } from '../../utils/Constants';
import { calculateAbsoluteAngles } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { getVisiblePoint, testPointNative } from '../../utils/Raytrace';

const COAL_BLOCK = new BlockType('minecraft:coal_block');
const RANGE = 12;
const RETRY_DELAY = 1000;
const ESP_COLOR = new RenderColor(0, 220, 255, 255);

class ScribeNuker extends ModuleBase {
    constructor() {
        super({
            name: 'Scribe Nuker',
            subcategory: 'Rift',
            description: 'Instantly looks at nearby coal blocks, changing targets each tick.',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();
        this.retryAt = new Map();
        this.blocks = [];
        this.on('tick', () => this.tick());
        this.on('postRenderWorld', () => {
            if (this.blocks.length) Render3D.drawWireFrameBoxes(this.blocks, ESP_COLOR, 2, false);
        });
    }

    onEnable() {
        this.retryAt.clear();
        this.blocks = [];
    }

    onDisable() {
        this.blocks = [];
    }

    tick() {
        const player = Player.getPlayer();
        if (!player || !World.isLoaded()) {
            this.blocks = [];
            return;
        }

        const now = Date.now();
        for (const [key, time] of this.retryAt) if (time <= now) this.retryAt.delete(key);

        const eyePosition = player.getEyePosition();
        const eyes = { x: eyePosition.x(), y: eyePosition.y(), z: eyePosition.z() };
        const x = Math.floor(player.getX());
        const y = Math.floor(player.getY());
        const z = Math.floor(player.getZ());
        let target = null;
        let closest = RANGE ** 2;
        this.blocks = [];
        const minY = Math.max(y - RANGE, 67);
        const maxY = Math.min(y + RANGE, 73);
        if (minY > maxY) return;

        for (const block of World.getBlocksInBox(x - RANGE, minY, z - RANGE, x + RANGE, maxY, z + RANGE, [COAL_BLOCK])) {
            if (block.y === 69 && block.x >= 18 && block.x <= 27 && block.z >= -50 && block.z <= -48) continue;
            const distance = (block.x + 0.5 - eyes.x) ** 2 + (block.y + 0.5 - eyes.y) ** 2 + (block.z + 0.5 - eyes.z) ** 2;
            if (distance >= RANGE ** 2) continue;
            this.blocks.push(new Vec3d(block.x, block.y, block.z));
            const key = `${block.x},${block.y},${block.z}`;
            if (this.retryAt.has(key)) continue;
            if (distance >= closest) continue;
            const faces = [];
            if (eyes.x < block.x) faces.push([block.x + 0.01, block.y + 0.5, block.z + 0.5]);
            if (eyes.x > block.x + 1) faces.push([block.x + 0.99, block.y + 0.5, block.z + 0.5]);
            if (eyes.y < block.y) faces.push([block.x + 0.5, block.y + 0.01, block.z + 0.5]);
            if (eyes.y > block.y + 1) faces.push([block.x + 0.5, block.y + 0.99, block.z + 0.5]);
            if (eyes.z < block.z) faces.push([block.x + 0.5, block.y + 0.5, block.z + 0.01]);
            if (eyes.z > block.z + 1) faces.push([block.x + 0.5, block.y + 0.5, block.z + 0.99]);
            const face = faces.find((point) => testPointNative(block.x, block.y, block.z, point, eyes)) || getVisiblePoint(block.x, block.y, block.z);
            if (!face) continue;
            closest = distance;
            target = { x: face[0], y: face[1], z: face[2], key };
        }

        if (!target) return;
        const { yaw, pitch } = calculateAbsoluteAngles(target);
        player.setYRot(yaw);
        player.setXRot(pitch);
        this.retryAt.set(target.key, now + RETRY_DELAY);
    }
}

new ScribeNuker();
