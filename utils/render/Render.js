const RenderUtils = Java.type('com.v5.render.RenderUtils');
const RColor = Java.type('com.v5.render.RenderUtils$Color');

class RenderObject {
    // Basic 1x1x1 filled box
    drawBox(pos, color, depth = false) {
        RenderUtils.drawFilledBox(pos, color, depth);
    }

    // Basic 1x1x1 wireframe
    drawWireFrame(pos, color, thickness = 5, depth = false) {
        RenderUtils.drawWireFrame(pos, color, thickness, depth);
    }

    // Filled box + Wireframe outline
    drawStyledBox(pos, color1, color2, thickness = 5, depth = false) {
        RenderUtils.drawStyledBox(pos, color1, color2, thickness, depth);
    }

    // Custom sized box
    drawSizedBox(pos, width, height, length, color, filled = true, thickness = 5, depth = false) {
        RenderUtils.drawSizedBox(pos, width, height, length, color, filled, thickness, depth);
    }

    // 3D Text
    drawText(text, pos, scale = 1, backgroundBox = false, increase = false, seeThrough = false, translate = true) {
        RenderUtils.drawText(text, pos, scale, backgroundBox, increase, seeThrough, translate);
    }

    // Line between two points
    drawLine(startVec3d, endVec3d, color, thickness = 5, depth = false) {
        RenderUtils.drawLine(startVec3d, endVec3d, color, thickness, depth);
    }

    // Tracer from crosshair to target
    drawTracer(target, color, thickness = 5, depth = false) {
        RenderUtils.drawTracer(target, color, thickness, depth);
    }

    // Smooth interpolated entity hitbox
    drawHitbox(mob, color, thickness = 5, depth = false) {
        RenderUtils.drawHitbox(mob, color, thickness, depth);
    }

    Color(r, g, b, a) {
        return new RColor(r, g, b, a);
    }
}

const Render = new RenderObject();
export default Render;
