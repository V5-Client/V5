import RenderUtils from '../Rendering/RendererUtils';
import { Vec3d } from '../Utility/Constants';
import { movementState, pathNodes, keyNodes } from './PathState';

const COLORS = {
    CURRENT: [255, 255, 0, 100],
    PAST: [76, 76, 76, 76],
    FUTURE: [0, 255, 0, 127],
    KEY: [255, 0, 0, 204],
    TARGET: [0, 255, 255, 255],
};

export function renderPath() {
    const { splinePath, currentNodeIndex, isWalking, targetPoint } =
        movementState;

    splinePath.forEach((node, i) => {
        const color =
            i === currentNodeIndex
                ? COLORS.CURRENT
                : i < currentNodeIndex
                ? COLORS.PAST
                : COLORS.FUTURE;
        RenderUtils.drawStyledBox(
            new Vec3d(node.x, node.y, node.z),
            color,
            color,
            5,
            false
        );
    });

    keyNodes.forEach((node) =>
        RenderUtils.drawStyledBox(
            new Vec3d(node.x, node.y, node.z),
            COLORS.KEY,
            COLORS.KEY,
            5,
            false
        )
    );

    if (isWalking && targetPoint) {
        RenderUtils.drawStyledBox(
            new Vec3d(targetPoint.x, targetPoint.y, targetPoint.z),
            COLORS.TARGET,
            COLORS.TARGET,
            5,
            false
        );
    }
}
