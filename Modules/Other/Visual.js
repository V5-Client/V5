import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { RayTrace } from '../../Utility/Raytrace';

const exclusions = [
    0, 51, 171, 144, 69, 77, 143, 50, 131, 132, 66, 157, 78, 141, 59, 142, 115,
    104, 105, 76, 55, 38, 37, 6, 140, 32, 31, 65, 175, 93, 94, 149, 150, 30,
    111, 9, 11, 50, 106, 39, 40, 36,
];

register('postRenderWorld', () => {
    let heldItem = Player.getHeldItem();

    if (
        Player.isSneaking() &&
        Player.getHeldItem() &&
        heldItem.getName().toLowerCase().includes('aspect of the')
    ) {
        let block = RayTrace.raytrace(61);
        if (
            block &&
            !exclusions.includes(
                World.getBlockAt(block.x, block.y, block.z).getType().getID()
            ) &&
            World.getBlockAt(block.x, block.y + 1, block.z)
                .getType()
                .getID() === 0 &&
            World.getBlockAt(block.x, block.y + 2, block.z)
                .getType()
                .getID() === 0
        ) {
            RenderUtils.drawBox(
                new Vec3d(block.x, block.y, block.z),
                [0, 255, 0, 255]
            );
        } else {
            if (!block) return;
            RenderUtils.drawBox(
                new Vec3d(block?.x, block?.y, block?.z),
                [255, 0, 0, 255]
            );
        }
    }
});
