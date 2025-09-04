const RenderSystem = com.mojang.blaze3d.systems.RenderSystem;
const RenderPipeline = net.minecraft.client.gl.RenderPipelines;

// Helpers - Use RendererMain.js methods!

export default class RendererUtils {
    static getSlotPos(slotIndex) {
        const screen = Player.getContainer().screen;
        if (
            !screen ||
            !(
                screen instanceof
                net.minecraft.client.gui.screen.ingame.HandledScreen
            )
        )
            new Vec3i(0, 0, 0);
        const slot = screen.getScreenHandler().slots.get(slotIndex);
        return new Vec3i(screen.x + slot.x, screen.y + slot.y, 0);
    }
    static getSlotCenter(slot) {
        const { x, y } = RendererUtils.getSlotPos(slot);
        return new Vec3i(x + 8, y + 8, 0);
    }
    static getPositionMatrix() {
        return Renderer.matrixStack.toMC().peek().positionMatrix;
    }
    static setupRender() {
        RenderSystem.disableCull();
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
    }
    static endRender() {
        RenderSystem.disableBlend();
        RenderSystem.enableCull();
    }

    // static getSlotCenter(slot) {
    // 	const invSize = Player.getContainer()?.getSize() || 0;
    // 	let x = slot % 9;
    // 	let y = Math.floor(slot / 9);
    // 	let renderX = Renderer.screen.getWidth() / 2 + (x - 4) * 18;
    // 	let renderY = (Renderer.screen.getHeight() + 9) / 2 + (y - invSize / 18) * 18;
    // 	if (slot >= invSize - 36) renderY += 13;
    // 	return [renderX, renderY];
    // }

    static colorToARGB(color) {
        return (
            (color.getAlpha() << 24) |
            (color.getRed() << 16) |
            (color.getGreen() << 8) |
            color.getBlue()
        );
    }
}

export class Align {
    static TOP_LEFT = 'TOP_LEFT';
    static TOP = 'TOP_CENTER';
    static TOP_RIGHT = 'TOP_RIGHT';
    static LEFT = 'CENTER_LEFT';
    static CENTER = 'CENTER_CENTER';
    static RIGHT = 'CENTER_RIGHT';
    static BOTTOM_LEFT = 'BOTTOM_LEFT';
    static BOTTOM = 'BOTTOM_CENTER';
    static BOTTOM_RIGHT = 'BOTTOM_RIGHT';
}

const VertexFormat = net.minecraft.client.render.VertexFormat;
const VertexFormats = net.minecraft.client.render.VertexFormats;
const RenderPhase = net.minecraft.client.render.RenderPhase;
const RenderLayer = net.minecraft.client.render.RenderLayer;
const OptionalDouble = java.util.OptionalDouble;
const linesCache = new Map();
const linesThroughWallsCache = new Map();
let filledThroughWallsCache = null;
export class RenderLayers {
    static getFilledThroughWalls = () => {
        if (filledThroughWallsCache) {
            return filledThroughWallsCache;
        }
        return (filledThroughWallsCache = RenderLayer.of(
            'filled_through_walls',
            VertexFormats.POSITION_COLOR,
            VertexFormat.class_5596.TRIANGLE_STRIP, // .DrawMode.
            1536,
            false,
            true,
            RenderLayer.class_4688 // .MultiPhaseParameters.builder()
                .method_23598()
                .layering(RenderPhase.VIEW_OFFSET_Z_LAYERING)
                .layering(RenderPhase.POLYGON_OFFSET_LAYERING)
                .build(false)
        ));
    };

    static getLinesThroughWalls = (lineWidth = 1) => {
        if (linesThroughWallsCache.has(lineWidth)) {
            return linesThroughWallsCache.get(lineWidth);
        }
        const layer = RenderLayer.of(
            'lines_through_walls',
            1536,
            RenderPipeline.DEBUG_LINE_STRIP, // jank fix but looks good imo
            RenderLayer.class_4688 // .MultiPhaseParameters.builder()
                .method_23598()
                .layering(RenderPhase.VIEW_OFFSET_Z_LAYERING)
                .target(RenderPhase.OUTLINE_TARGET)
                .lineWidth(
                    new RenderPhase.class_4677(OptionalDouble.of(lineWidth))
                ) // .LineWidth()
                .build(false)
        );
        linesThroughWallsCache.set(lineWidth, layer);
        return layer;
    };

    static getLines = (lineWidth = 2) => {
        if (linesCache.has(lineWidth)) {
            return linesCache.get(lineWidth);
        }
        const layer = RenderLayer.of(
            'lines',
            1536,
            RenderPipeline.LINES,
            RenderLayer.class_4688 // .MultiPhaseParameters.builder()
                .method_23598()
                .layering(RenderPhase.VIEW_OFFSET_Z_LAYERING)
                .target(RenderPhase.ITEM_ENTITY_TARGET)
                .lineWidth(
                    new RenderPhase.class_4677(OptionalDouble.of(lineWidth))
                ) // .LineWidth()
                .build(false)
        );
        linesCache.set(lineWidth, layer);
        return layer;
    };
}

export class OutlineMode {
    static CENTER = 'CENTER';
    static OUTLINE = 'OUTLINE';
    static INLINE = 'INLINE';
}
