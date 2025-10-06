import RenderUtils from '../Rendering/RendererUtils';
import { Vec3d } from '../Utility/Constants';
import { movementState, pathNodes, keyNodes } from './PathState';

export function renderPath() {
    movementState.splinePath.forEach((node, i) => {
        const isCurrent = i === movementState.currentNodeIndex;
        const color = isCurrent
            ? [255, 255, 0, 100] // YELLOW for current node
            : i < movementState.currentNodeIndex
            ? [76, 76, 76, 76] // GREY for past nodes
            : [0, 255, 0, 127]; // GREEN for future nodes

        RenderUtils.drawStyledBox(
            // SPLINE NODES - GREEN for future, grey for past, yellow for current
            new Vec3d(node.x, node.y, node.z),
            color,
            color,
            5,
            false
        );
    });

    keyNodes.forEach((node) =>
        RenderUtils.drawStyledBox(
            // KEY NODES - RED
            new Vec3d(node.x, node.y, node.z),
            [255, 0, 0, 204],
            [255, 0, 0, 204],
            5,
            false
        )
    );

    if (movementState.isWalking && movementState.targetPoint) {
        RenderUtils.drawStyledBox(
            // LOOKAHEAD TARGET - CYAN
            new Vec3d(
                movementState.targetPoint.x,
                movementState.targetPoint.y,
                movementState.targetPoint.z
            ),
            [0, 255, 255, 255],
            [0, 255, 255, 255],
            5,
            false
        );
    }
}
