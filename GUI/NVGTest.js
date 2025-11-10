const NanoVGRenderer = Java.type('com.chattriggers.ctjs.api.render.NanoVGRenderer');
const Color = Java.type('java.awt.Color');
const FileInputStream = Java.type('java.io.FileInputStream');
const MinecraftClient = Java.type('net.minecraft.client.MinecraftClient');

const RENDER_ABOVE_GUI = true;

class NanoVGModule {
    constructor() {
        this.enabled = false;
        this.customFont = null;
        this.loadFont();

        let renderTrigger = register('renderOverlay', () => {
            if (!RENDER_ABOVE_GUI || !Client.isInGui()) {
                this.render();
            }
        }).unregister();

        let guiRenderTrigger = register('postGuiRender', () => {
            this.renderAboveGui();
        }).unregister();

        this.toggle = (value) => {
            this.enabled = value;
            if (value) {
                renderTrigger.register();
                if (RENDER_ABOVE_GUI) guiRenderTrigger.register();
            } else {
                renderTrigger.unregister();
                guiRenderTrigger.unregister();
            }
        };

        this.toggle(true);
    }

    loadFont() {
        const fontPath = 'config/ChatTriggers/assets/Inter_28pt-Medium.ttf';
        try {
            const inputStream = new FileInputStream(fontPath);
            this.customFont = NanoVGRenderer.createFont('Inter', inputStream);
            console.log(`Successfully loaded font: ${fontPath}`);
        } catch (e) {
            console.log(`Error loading font: ${fontPath}`);
            console.log(e);
        }
    }

    render() {
        const fontToUse = this.customFont ? this.customFont : NanoVGRenderer.getDefaultFont();
        const mc = MinecraftClient.getInstance();
        const guiScale = mc.options.getGuiScale().getValue() || 1;

        const width = Renderer.screen.getWidth();
        const height = Renderer.screen.getHeight();
        const fbWidth = width * guiScale;
        const fbHeight = height * guiScale;

        const fontSize = 32.0 * guiScale;

        NanoVGRenderer.begin(fbWidth, fbHeight);

        const positions = [
            { text: 'Top Left', x: 10, y: 10, color: new Color(0.2, 1.0, 0.2) },
            { text: 'Top Right', x: fbWidth - 10, y: 10, color: new Color(0.2, 0.6, 1.0), align: 'right' },
            { text: 'Bottom Left', x: 10, y: fbHeight - fontSize * 1.5, color: new Color(0.7, 0.3, 1.0) },
            { text: 'Bottom Right', x: fbWidth - 10, y: fbHeight - fontSize * 1.5, color: new Color(1.0, 0.6, 0.2), align: 'right' },
            { text: 'CENTER', x: fbWidth / 2, y: fbHeight / 2, color: new Color(1.0, 1.0, 0.2), align: 'center' },
        ];

        for (const { text, x, y, color, align } of positions) {
            const textWidth = NanoVGRenderer.textWidth(text, fontSize, fontToUse);
            let drawX = x;
            if (align === 'right') drawX = x - textWidth;
            if (align === 'center') drawX = x - textWidth / 2;

            NanoVGRenderer.text(text, drawX, y, fontSize, color, fontToUse);
        }

        NanoVGRenderer.end();
    }

    renderAboveGui() {
        if (!RENDER_ABOVE_GUI || !Client.isInGui()) return;
        Renderer.translate(0, 0, 500);
        this.render();
        Renderer.translate(0, 0, -500);
    }
}

new NanoVGModule();
