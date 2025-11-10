const NanoVGRenderer = Java.type('com.chattriggers.ctjs.api.render.NanoVGRenderer');
const FileInputStream = Java.type('java.io.FileInputStream');
const MinecraftClient = Java.type('net.minecraft.client.MinecraftClient');

class NVGTextUtility {
    constructor() {
        this.fonts = new Map();
        this.defaultFont = NanoVGRenderer.getDefaultFont();
        this.currentGuiScale = 1;
        this.fbWidth = 0;
        this.fbHeight = 0;
        this.isRendering = false;
    }

    /**
     * Load a custom font
     * @param {string} name - Name to reference this font
     * @param {string} path - Path to the font file
     * @returns {boolean} Success status
     */
    loadFont(name, path) {
        try {
            const inputStream = new FileInputStream(path);
            const font = NanoVGRenderer.createFont(name, inputStream);
            this.fonts.set(name, font);
            console.log(`Successfully loaded font: ${name} from ${path}`);
            return true;
        } catch (e) {
            console.log(`Error loading font ${name}: ${path}`);
            console.log(e);
            return false;
        }
    }

    /**
     * Get a loaded font by name
     * @param {string} name - Font name
     * @returns Font object or default font
     */
    getFont(name) {
        return this.fonts.get(name) || this.defaultFont;
    }

    /**
     * Begin rendering
     * Call this before any rendering draw calls
     */
    begin() {
        if (this.isRendering) return;

        const mc = MinecraftClient.getInstance();
        this.currentGuiScale = mc.options.getGuiScale().getValue() || 1;

        const width = Renderer.screen.getWidth();
        const height = Renderer.screen.getHeight();
        this.fbWidth = width * this.currentGuiScale;
        this.fbHeight = height * this.currentGuiScale;

        NanoVGRenderer.begin(this.fbWidth, this.fbHeight);
        this.isRendering = true;
    }

    /**
     * End rendering
     */
    end() {
        if (!this.isRendering) return;
        NanoVGRenderer.end();
        this.isRendering = false;
    }

    /**
     * Render text
     * @param {string} text - Text to render
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} fontSize - Font size (will be scaled automatically)
     * @param {Color} color - Text color
     * @param {string} fontName - Font name (optional, uses default if null)
     */
    drawText(text, x, y, fontSize, color, fontName = null) {
        if (!this.isRendering) {
            console.log('Warning: drawText called without begin()');
            return;
        }

        const font = fontName ? this.getFont(fontName) : this.defaultFont;
        const scaledSize = fontSize * this.currentGuiScale;

        NanoVGRenderer.text(text, x, y, scaledSize, color, font);
    }

    /**
     * Calculate text width
     * @param {string} text - Text to measure
     * @param {number} fontSize - Font size
     * @param {string} fontName - Font name (optional)
     * @returns {number} Text width
     */
    getTextWidth(text, fontSize, fontName = null) {
        const font = fontName ? this.getFont(fontName) : this.defaultFont;
        const scaledSize = fontSize * this.currentGuiScale;
        return NanoVGRenderer.textWidth(text, scaledSize, font);
    }

    /**
     * Get current framebuffer dimensions
     * @returns {Object} {width, height}
     */
    getDimensions() {
        return {
            width: this.fbWidth,
            height: this.fbHeight,
        };
    }

    /**
     * Get current GUI scale
     * @returns {number} GUI scale
     */
    getGuiScale() {
        return this.currentGuiScale;
    }
}

export const NVGText = new NVGTextUtility();
