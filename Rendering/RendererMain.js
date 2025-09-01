import RenderLib3d from './Render3DUtils';
import RenderLib2d from './Render2DUtils';

const Color = java.awt.Color;

export default class RendererMain {
    constructor() {}

    static drawWaypoint(coord = new Vec3i(0, 0, 0), filled = true, color) {
        RenderLib3d._drawBox({
            start: coord,
            size: new Vec3i(1, 1, 1),
            end: undefined,
            color: color,
            depthTest: false,
            filled: false,
            lineWidth: 2,
        });
    }

    static drawLine(start, end, color, lineWidth = 2, depthTest = false) {
        RenderLib3d.drawLine({
            start: start,
            end: end,
            color: color,
            lineWidth: lineWidth,
            depthTest: depthTest,
        });
    }
}
