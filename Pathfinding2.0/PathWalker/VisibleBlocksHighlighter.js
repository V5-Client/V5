import { RayTrace } from '../../Utility/Raytrace';
import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';

let isEnabled = false;
let maxDistance = 6;
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

    const playerLookVec = player.getRotationVec(1.0);
    if (!playerLookVec) return;

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

    const searchRadius = Math.ceil(radius) + 1;

    const fovAngle = Settings.getFOV() / 2;

    for (let x = centerX - searchRadius; x <= centerX + searchRadius; x++) {
        for (let y = centerY - searchRadius; y <= centerY + searchRadius; y++) {
            for (
                let z = centerZ - searchRadius;
                z <= centerZ + searchRadius;
                z++
            ) {
                const dx = x + 0.5 - playerPos.x;
                const dy = y + 0.5 - playerPos.y;
                const dz = z + 0.5 - playerPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                const dist = Math.sqrt(distSq);

                if (dist > radius + 0.87 || dist === 0) continue;

                const dirX = dx / dist;
                const dirY = dy / dist;
                const dirZ = dz / dist;

                const dotProduct =
                    playerLookVec.x * dirX +
                    playerLookVec.y * dirY +
                    playerLookVec.z * dirZ;

                const angle =
                    Math.acos(Math.max(-1, Math.min(1, dotProduct))) *
                    (180 / Math.PI);

                if (angle > fovAngle) continue;

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
