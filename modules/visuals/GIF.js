import { ModuleBase } from '../../utils/ModuleBase';
import { File, NVG } from '../../utils/Constants';
import { Chat } from '../../utils/Chat';
import { Utils } from '../../utils/Utils';

const GIF_SOURCE_DIR = new File('./config/ChatTriggers/modules/V5Config/gifs');
if (!GIF_SOURCE_DIR.exists()) GIF_SOURCE_DIR.mkdirs();

class GifInstance {
    constructor(file, savedConfig) {
        this.file = file;
        this.name = file.getName();
        this.absPath = file.getAbsolutePath();

        this.loaded = false;
        this.baseWidth = 0;
        this.baseHeight = 0;
        this.frameCount = 0;
        this.delaysMs = [];
        this.retryDelayMs = 500;
        this.nextRetryAt = 0;

        this.frameIndex = 0;
        this.accMs = 0;
        this.lastTimestamp = Date.now();

        this.dragging = false;
        this.scaling = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.initialScale = 1;
        this.initialMouseX = 0;

        this.load();

        if (savedConfig) {
            this.x = savedConfig.x;
            this.y = savedConfig.y;
            this.scale = savedConfig.scale;
        } else {
            this.x = 100;
            this.y = 100;
            this.scale = 1.0;

            if (this.loaded) {
                const sw = Renderer.screen.getWidth();
                const sh = Renderer.screen.getHeight();

                if (this.baseWidth > sw || this.baseHeight > sh) {
                    const targetW = sw / 3;
                    const targetH = sh / 3;

                    const scaleW = targetW / this.baseWidth;
                    const scaleH = targetH / this.baseHeight;

                    this.scale = Math.min(scaleW, scaleH);
                }
            }
        }
    }

    load() {
        Client.getMinecraft().execute(() => {
            let gifData = null;
            try {
                gifData = NVG.loadGif(this.absPath);
            } catch (e) {
                return;
            }
        });

        if (!gifData) {
            Chat.message(`&c[GIF] Failed to load ${this.name}. This could be due to an invalid gif file.`);
            this.scheduleRetry();
            return;
        }

        this.baseWidth = gifData.getWidth();
        this.baseHeight = gifData.getHeight();
        this.frameCount = gifData.getFrameCount();
        this.delaysMs = gifData.getDelays();
        this.loaded = true;
    }

    scheduleRetry() {
        const now = Date.now();
        this.nextRetryAt = now + this.retryDelayMs;
        this.retryDelayMs = Math.min(this.retryDelayMs * 1.5, 5000);
    }

    unload() {
        this.loaded = false;
    }

    render(isChatOpen) {
        if (!this.loaded || this.frameCount === 0) {
            if (!this.loaded && Date.now() >= this.nextRetryAt) {
                this.load();
            }
            return;
        }

        const now = Date.now();
        const dt = now - this.lastTimestamp;
        this.lastTimestamp = now;

        this.accMs += dt;
        const currentDelay = this.delaysMs[this.frameIndex] || 100;

        while (this.accMs >= currentDelay) {
            this.accMs -= currentDelay;
            this.frameIndex = (this.frameIndex + 1) % this.frameCount;
        }

        const drawW = this.baseWidth * this.scale;
        const drawH = this.baseHeight * this.scale;

        NVG.drawGif(this.absPath, this.x, this.y, drawW, drawH, this.frameIndex);

        if (isChatOpen) {
            this.drawMoveUI(this.x, this.y, drawW, drawH);
        }
    }

    drawMoveUI(x, y, width, height) {
        const borderColor = 0x80ffffff | 0;
        const cornerColor = 0xccffffff | 0;
        const handleColor = 0xcc5099ff | 0;

        const minHandlePx = 8;
        const minLinePx = 1;
        const handleSize = Math.max(minHandlePx, 14 * this.scale);
        const cornerSize = Math.max(minHandlePx * 0.5, 6 * this.scale);
        const lineThick = Math.max(minLinePx, 2 * this.scale);

        NVG.drawRect(x - lineThick, y - lineThick, width + lineThick * 2, lineThick, borderColor); // Top
        NVG.drawRect(x - lineThick, y + height, width + lineThick * 2, lineThick, borderColor); // Bottom
        NVG.drawRect(x - lineThick, y, lineThick, height, borderColor); // Left
        NVG.drawRect(x + width, y, lineThick, height, borderColor); // Right

        NVG.drawRect(x - lineThick, y - lineThick, cornerSize, lineThick, cornerColor);
        NVG.drawRect(x + width - cornerSize + lineThick, y - lineThick, cornerSize, lineThick, cornerColor);
        NVG.drawRect(x + width - cornerSize + lineThick, y + height, cornerSize, lineThick, cornerColor);
        NVG.drawRect(x - lineThick, y + height, cornerSize, lineThick, cornerColor);

        const hx = x + width - handleSize;
        const hy = y + height - handleSize;

        NVG.drawRect(hx, hy, handleSize, handleSize, handleColor);

        const innerPadding = handleSize * (4 / 14);
        const innerSize = handleSize - innerPadding * 2;
        if (innerSize > 0) {
            NVG.drawRect(hx + innerPadding, hy + innerPadding, innerSize, innerSize, cornerColor);
        }
    }

    isInside(mx, my, x, y, w, h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    handleClick(mx, my, isPressed) {
        const drawW = this.baseWidth * this.scale;
        const drawH = this.baseHeight * this.scale;
        const minHandlePx = 8;
        const handleSize = Math.max(minHandlePx, 14 * this.scale);

        if (isPressed) {
            if (this.isInside(mx, my, this.x + drawW - handleSize, this.y + drawH - handleSize, handleSize, handleSize)) {
                this.scaling = true;
                this.initialScale = this.scale;
                this.initialMouseX = mx;
                return true;
            }

            if (this.isInside(mx, my, this.x, this.y, drawW, drawH)) {
                this.dragging = true;
                this.dragOffsetX = mx - this.x;
                this.dragOffsetY = my - this.y;
                return true;
            }
        } else {
            this.dragging = false;
            this.scaling = false;
        }
        return false;
    }

    handleDrag(mx, my) {
        if (this.dragging) {
            const drawW = this.baseWidth * this.scale;
            const drawH = this.baseHeight * this.scale;
            const screenW = Renderer.screen.getWidth();
            const screenH = Renderer.screen.getHeight();

            const newX = mx - this.dragOffsetX;
            const newY = my - this.dragOffsetY;

            this.x = Math.max(0, Math.min(newX, screenW - drawW));
            this.y = Math.max(0, Math.min(newY, screenH - drawH));
            return true;
        } else if (this.scaling) {
            const screenW = Renderer.screen.getWidth();
            const screenH = Renderer.screen.getHeight();

            const initialDrawW = this.baseWidth * this.initialScale;
            const newDrawW = initialDrawW + (mx - this.initialMouseX);

            let newScale = newDrawW / this.baseWidth;
            const minScale = Math.max(0.1, 8 / this.baseWidth);
            newScale = Math.max(minScale, newScale);

            const maxScaleW = screenW / this.baseWidth;
            const maxScaleH = screenH / this.baseHeight;
            const maxScale = Math.min(maxScaleW, maxScaleH);

            this.scale = Math.min(newScale, maxScale);
            return true;
        }
        return false;
    }

    getSaveData() {
        return {
            x: this.x,
            y: this.y,
            scale: this.scale,
        };
    }
}

class GIFOverlay extends ModuleBase {
    constructor() {
        super({
            name: 'GIF Overlay',
            subcategory: 'Visuals',
            description: 'Display animated GIFs on your screen',
            tooltip: 'Select GIFs to display. Open chat to move/resize.',
        });

        this.instances = [];
        this.positionConfig = Utils.getConfigFile('gif_positions.json') || {};
        this.renderOverEverything = true;

        const gifFiles = this.getGifFiles();
        const gifNames = gifFiles.map((f) => f.getName());

        if (gifNames.length > 0) {
            this.addMultiToggle('Active GIFs', gifNames, false, (toggled) => this.updateInstances(toggled, gifFiles));
        } else {
            this.addMultiToggle('No GIFs Found', ['Put .gif files in', 'config/ChatTriggers', 'modules/V5Config/gifs'], false, () => {});
        }

        this.addToggle('Render Over Everything', (value) => (this.renderOverEverything = !!value), 'Render GIFs above GUI and overlays', true);

        NVG.registerV5Render(() => {
            if (!this.renderOverEverything || !this.enabled) return;
            this.render();
        });

        this.on('renderOverlay', () => {
            if (this.renderOverEverything) return;
            this.render();
        });
        this.on('clicked', (x, y, button, isPressed) => this.handleClick(x, y, button, isPressed));
        this.on('dragged', (dx, dy, x, y, button) => this.handleDrag(dx, dy, x, y, button));

        register('gameUnload', () => {
            this.savePositions();
            this.resetAll();
        });
        register('guiClosed', () => this.savePositions());
    }

    isChatOpen() {
        const gui = Client.currentGui.get();
        if (!gui) return false;
        return gui.class.simpleName == 'class_408';
    }

    getGifFiles() {
        const files = GIF_SOURCE_DIR.listFiles();
        if (!files) return [];
        return Array.from(files).filter((f) => f.isFile() && String(f.getName()).toLowerCase().endsWith('.gif'));
    }

    updateInstances(toggledOptions, allFiles) {
        this.instances.forEach((inst) => {
            this.positionConfig[inst.name] = inst.getSaveData();
        });

        this.instances = this.instances.filter((inst) => {
            const option = toggledOptions.find((o) => o.name === inst.name);
            if (!option || !option.enabled) {
                inst.unload();
                return false;
            }
            return true;
        });

        toggledOptions.forEach((option) => {
            if (option.enabled && !this.instances.some((inst) => inst.name === option.name)) {
                const file = allFiles.find((f) => f.getName() === option.name);
                if (file) {
                    const savedData = this.positionConfig[option.name];
                    this.instances.push(new GifInstance(file, savedData));
                }
            }
        });

        this.savePositions();
    }

    render() {
        if (this.instances.length === 0) return;

        const chatOpen = this.isChatOpen();

        NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
        this.instances.forEach((inst) => inst.render(chatOpen));
        NVG.endFrame();
    }

    handleClick(x, y, button, isPressed) {
        if (this.instances.length === 0 || !this.isChatOpen() || button !== 0) return;

        const scale = Client.getMinecraft().getWindow().getScaleFactor();
        const mx = x / scale;
        const my = y / scale;

        for (let i = this.instances.length - 1; i >= 0; i--) {
            const inst = this.instances[i];
            if (inst.handleClick(mx, my, isPressed)) {
                break;
            }
        }
    }

    handleDrag(dx, dy, x, y, button) {
        if (this.instances.length === 0 || !this.isChatOpen() || button !== 0) return;

        const scale = Client.getMinecraft().getWindow().getScaleFactor();
        const mx = x / scale;
        const my = y / scale;

        for (let i = this.instances.length - 1; i >= 0; i--) {
            if (this.instances[i].handleDrag(mx, my)) {
                break;
            }
        }
    }

    savePositions() {
        if (!this.instances) return;

        const data = {};
        this.instances.forEach((inst) => {
            data[inst.name] = inst.getSaveData();
        });

        const merged = { ...this.positionConfig, ...data };
        this.positionConfig = merged;

        Utils.writeConfigFile('gif_positions.json', merged);
    }

    resetAll() {
        this.toggle(false);
        if (this.instances && this.instances.length > 0) {
            this.instances.forEach((inst) => inst.unload());
        }
        this.instances = [];
    }
}

new GIFOverlay();
