import './ProfileSettings';
import './ThemeSettings';

const warmupTrigger = register('renderOverlay', () => {
    try {
        const width = Renderer.screen.getWidth();
        const height = Renderer.screen.getHeight();
        if (width <= 0 || height <= 0) return;
        NVG.beginFrame(width, height);
        NVG.endFrame();
        warmupTrigger.unregister();
    } catch (e) {
        console.error(e);
        warmupTrigger.unregister();
    }
});
