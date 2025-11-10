import { NVGText } from './Utility/NVGText';

const Color = Java.type('java.awt.Color');
const RENDER_ABOVE_GUI = true;

class NanoVGModule {
    constructor() {
        this.enabled = false;

        NVGText.loadFont('Inter', 'config/ChatTriggers/assets/Inter_28pt-Medium.ttf');

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

    render() {
        NVGText.begin();

        const { width, height } = NVGText.getDimensions();
        const fontSize = 32;

        // Top Left
        NVGText.drawText('Top Left', 10, 10, fontSize, new Color(0.2, 1.0, 0.2), 'Inter');

        // Top Right
        const topRightText = 'Top Right';
        const topRightWidth = NVGText.getTextWidth(topRightText, fontSize, 'Inter');
        NVGText.drawText(topRightText, width - topRightWidth - 10, 10, fontSize, new Color(0.2, 0.6, 1.0), 'Inter');

        // Bottom Left
        NVGText.drawText('Bottom Left', 10, height - fontSize * NVGText.getGuiScale() * 1.5, fontSize, new Color(0.7, 0.3, 1.0), 'Inter');

        // Bottom Right
        const bottomRightText = 'Bottom Right';
        const bottomRightWidth = NVGText.getTextWidth(bottomRightText, fontSize, 'Inter');
        NVGText.drawText(
            bottomRightText,
            width - bottomRightWidth - 10,
            height - fontSize * NVGText.getGuiScale() * 1.5,
            fontSize,
            new Color(1.0, 0.6, 0.2),
            'Inter'
        );

        // Center
        const centerText = 'CENTER';
        const centerWidth = NVGText.getTextWidth(centerText, fontSize, 'Inter');
        NVGText.drawText(centerText, width / 2 - centerWidth / 2, height / 2, fontSize, new Color(1.0, 1.0, 0.2), 'Inter');

        NVGText.end();
    }

    renderAboveGui() {
        if (!RENDER_ABOVE_GUI || !Client.isInGui()) return;
        Renderer.translate(0, 0, 500);
        this.render();
        Renderer.translate(0, 0, -500);
    }
}

new NanoVGModule();
