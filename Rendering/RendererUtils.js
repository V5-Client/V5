import { Color, Vec3d } from '../Utility/Constants';

const RenderUtilsPackage = Java.type('com.chattriggers.v5.render.RenderUtils');

export default class RenderUtils {
    constructor() {}

    /**
     * @function drawWireFrame creates a frame around a block
     * @param {Vec3d} Vec3d a Vec3d coordinate
     * @param {Array} ColorArray requires 4 items in an array of numbers between 0-255
     * @param {Float16Array} thickness thickness of each wire
     * @param {Boolean} depth hide behind blocks
     */
    static drawWireFrame(Vec3d, ColorArray, thickness = 5, depth = false) {
        RenderUtilsPackage.drawWireFrameBox(Vec3d, this.setColor(ColorArray[0], ColorArray[1], ColorArray[2], ColorArray[3]), thickness, depth);
    }

    /**
     * @function drawBox creates a fully filled box around a block
     * @param {Vec3d} Vec3d a Vec3d coordinate
     * @param {Array} ColorArray requires 4 items in an array of numbers between 0-255
     * @param {Boolean} depth hide behind blocks
     */
    static drawBox(Vec3d, ColorArray, depth = false) {
        RenderUtilsPackage.drawFilledBox(Vec3d, this.setColor(ColorArray[0], ColorArray[1], ColorArray[2], ColorArray[3]), depth);
    }

    /**
     * @function drawStyledBox creates a fully filled box around a block with wireframes, much more peformance costly
     * @param {Vec3d} Vec3d a Vec3d coordinate
     * @param {Array} ColorArray1 requires 4 items in an array of numbers between 0-255 - for  the filled box
     * @param {Array} ColorArray2 requires 4 items in an array of numbers between 0-255 - for the wireframe
     * @param {Float16Array} thickness thickness of each wire
     * @param {Boolean} depth hide behind blocks
     */
    static drawStyledBox(Vec3d, ColorArray1, ColorArray2, thickness = 5, depth = false) {
        RenderUtilsPackage.drawStyledBox(
            Vec3d,
            this.setColor(ColorArray1[0], ColorArray1[1], ColorArray1[2], ColorArray1[3]),
            this.setColor(ColorArray2[0], ColorArray2[1], ColorArray2[2], ColorArray2[3]),
            thickness,
            depth
        );
    }

    static drawStyledBoxWithText(
        Vec3d,
        ColorArray1,
        thickness = 5,
        depth = false,
        text,
        renderBlackBox = true,
        scale = 1,
        increase = false,
        centered = true,
        renderThroughBlocks = true
    ) {
        RenderUtilsPackage.drawStyledBox(
            Vec3d,
            this.setColor(ColorArray1[0], ColorArray1[1], ColorArray1[2], 70),
            this.setColor(ColorArray1[0], ColorArray1[1], ColorArray1[2], ColorArray1[3]),
            thickness,
            depth
        );

        RenderUtilsPackage.drawString(
            text,
            Vec3d.x + 0.5,
            Vec3d.y + 1.2,
            Vec3d.z + 0.5,
            Renderer.WHITE,
            renderBlackBox,
            scale,
            increase,
            centered,
            renderThroughBlocks
        );
    }

    // tesselator is retarded
    static drawString(text, x, y, z, color, renderBlackBox = true, scale = 1, increase = false, centered = true, renderThroughBlocks = true) {
        RenderUtilsPackage.drawString(text, x, y, z, color, renderBlackBox, scale, increase, centered, renderThroughBlocks);
    }

    /**
     * @function drawLine draws straight lines
     * @param {Vec3d} startVec3d a Vec3d coordinate
     * @param {Vec3d} endVec3d a Vec3d coordinate
     * @param {Array} ColorArray requires 4 items in an array of numbers between 0-255
     * @param {Float16Array} thickness thickness of each wire
     * @param {Boolean} depth hide behind blocks
     *
     * This is very costly, ill lf fix soon
     */
    static drawLine(startVec3d, endVec3d, ColorArray, thickness = 5, depth = false) {
        RenderUtilsPackage.drawLine(startVec3d, endVec3d, this.setColor(ColorArray[0], ColorArray[1], ColorArray[2], ColorArray[3]), thickness, depth);
    }

    /**
     * @function drawEntityHitbox renders a box around the bounding box of a mob
     * @param {MobEntity} Mob the type of mob you want to highlight
     * @param {Array} ColorArray requires 4 items in an array of numbers between 0-255
     * @param {Float16Array} thickness thickness of each wire
     * @param {Boolean} depth hide behind blocks
     *
     * im not sure on how to make this work atm :( - im lowk just retard
     */
    static drawEntityHitbox(Mob, ColorArray, thickness = 5, depth = false) {
        RenderUtilsPackage.drawEntityHitbox(Mob, this.setColor(ColorArray[0], ColorArray[1], ColorArray[2], ColorArray[3]), thickness, depth);
    }

    /**
     *
     * @param {*} r red in 0-255
     * @param {*} g green in 0-255
     * @param {*} b blue in 0-255
     * @param {*} a alpha in 0-255
     * @returns a data class accessible to other functions
     */
    static setColor(r, g, b, a) {
        return RenderUtilsPackage.createColor(r, g, b, a);
    }
}

new RenderUtils();
