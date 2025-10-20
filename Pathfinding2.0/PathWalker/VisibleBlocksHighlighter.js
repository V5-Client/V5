import { RayTrace } from '../../Utility/Raytrace';
import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';

let isEnabled = false;
let maxDistance = 5;
let highlightColor = [255, 255, 0, 100];
let wireframeColor = [255, 255, 0, 255];
let wireframeThickness = 3;

let lastUpdate = 0;
let updateInterval = 200;
let cachedBlocks = [];
let lastPlayerPos = null;
let lastPlayerLook = null;

function updateVisibleBlocks() {
    const currentTime = Date.now();
    if (currentTime - lastUpdate < updateInterval) return;
    lastUpdate = currentTime;

    const player = Player.getPlayer();
    if (!player) return;

    const playerPos = player.getEyePos();
    if (!playerPos) return;

    const playerLookVec = Player.getPlayer().getRotationVec(1.0);

    const playerMoved =
        !lastPlayerPos ||
        Math.abs(playerPos.x - lastPlayerPos.x) > 1 ||
        Math.abs(playerPos.y - lastPlayerPos.y) > 1 ||
        Math.abs(playerPos.z - lastPlayerPos.z) > 1;

    const playerRotated =
        !lastPlayerLook ||
        Math.abs(playerLookVec.x - lastPlayerLook.x) > 0.1 ||
        Math.abs(playerLookVec.y - lastPlayerLook.y) > 0.1 ||
        Math.abs(playerLookVec.z - lastPlayerLook.z) > 0.1;

    if (!playerMoved && !playerRotated) return;

    lastPlayerPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    lastPlayerLook = {
        x: playerLookVec.x,
        y: playerLookVec.y,
        z: playerLookVec.z,
    };

    cachedBlocks = [];
    const radius = maxDistance;
    const centerX = Math.floor(playerPos.x);
    const centerY = Math.floor(playerPos.y);
    const centerZ = Math.floor(playerPos.z);

    const searchRadius = Math.min(radius, 5);

    for (let x = centerX - searchRadius; x <= centerX + searchRadius; x++) {
        for (let y = centerY - searchRadius; y <= centerY; y++) {
            for (
                let z = centerZ - searchRadius;
                z <= centerZ + searchRadius;
                z++
            ) {
                const dx = x - playerPos.x;
                const dy = y - playerPos.y;
                const dz = z - playerPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > radius * radius) continue;

                if (y > centerY) continue;

                const dotProduct =
                    playerLookVec.x * dx +
                    playerLookVec.y * dy +
                    playerLookVec.z * dz;
                if (dotProduct < 0) continue;

                const block = World.getBlockAt(x, y, z);
                if (!block || block.type.getID() === 0) continue;

                const blockPos = { x, y, z };
                if (RayTrace.isBlockVisible(blockPos, playerPos, false)) {
                    cachedBlocks.push({ x, y, z });
                }
            }
        }
    }
}

function renderCachedBlocks() {
    cachedBlocks.forEach((block) => {
        const blockVec3d = new Vec3d(block.x, block.y, block.z);
        RenderUtils.drawWireFrame(
            blockVec3d,
            wireframeColor,
            wireframeThickness,
            false
        );
    });
}

register('postRenderWorld', () => {
    if (!isEnabled) return;

    updateVisibleBlocks();
    renderCachedBlocks();
});

register('command', () => {
    isEnabled = !isEnabled;
    ChatLib.chat(
        `Visible Blocks Highlighter: ${isEnabled ? 'Enabled' : 'Disabled'}`
    );
}).setName('toggleVisibleBlocks');
