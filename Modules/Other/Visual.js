import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { RayTrace } from '../../Utility/Raytrace';

const exclusions = [
    0, 51, 171, 144, 69, 77, 143, 50, 131, 132, 66, 157, 78, 141, 59, 142, 115,
    104, 105, 76, 55, 38, 37, 6, 140, 32, 31, 65, 175, 93, 94, 149, 150, 30,
    111, 9, 11, 50, 106, 39, 40, 36,
];

// caching stuff
let lastYaw = 0;
let lastPitch = 0;
let cachedBlock = null;
let cachedColor = null;

const ANGLE_THRESHOLD = 0.1; // this is prob really low but idc tbh

register('tick', () => {
    const heldItem = Player.getHeldItem();

    if (
        !Player.isSneaking() ||
        !heldItem ||
        !heldItem.getName().toLowerCase().includes('aspect of the')
    ) {
        cachedBlock = null;
        cachedColor = null;
        return;
    }

    const currentYaw = Player.getYaw();
    const currentPitch = Player.getPitch();

    // only raytrace if camera moved
    if (
        Math.abs(currentYaw - lastYaw) > ANGLE_THRESHOLD ||
        Math.abs(currentPitch - lastPitch) > ANGLE_THRESHOLD
    ) {
        cachedBlock = RayTrace.raytrace(61);

        // precalculate the color based on validity. idk if this is needed but who cares.
        if (cachedBlock && isValidTeleport(cachedBlock)) {
            cachedColor = [0, 255, 0, 255]; // green
        } else {
            cachedColor = [255, 0, 0, 255]; // red
        }

        lastYaw = currentYaw;
        lastPitch = currentPitch;
    }
});

register('postRenderWorld', () => {
    // POST RENDER WORLD ONLY SHOULD DO RENDERING, NOT CHECKING
    if (!cachedBlock) return;

    RenderUtils.drawBox(
        new Vec3d(cachedBlock.x, cachedBlock.y, cachedBlock.z),
        cachedColor
    );
});

function isValidTeleport(block) {
    const targetBlock = World.getBlockAt(block.x, block.y, block.z);
    const above1 = World.getBlockAt(block.x, block.y + 1, block.z);
    const above2 = World.getBlockAt(block.x, block.y + 2, block.z);

    return (
        !exclusions.includes(targetBlock.getType().getID()) &&
        above1.getType().getID() === 0 &&
        above2.getType().getID() === 0
    );
}
