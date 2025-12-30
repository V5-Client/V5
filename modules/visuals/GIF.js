import { ModuleBase } from '../../utils/ModuleBase';
import { File, Color, ImageIO, BufferedImage, AlphaComposite, NVG } from '../../utils/Constants';
import { Chat } from '../../utils/Chat';
import { drawImage } from '../../gui/Utils';

const GIF_SOURCE_DIR = new File('./config/ChatTriggers/modules/V5Config/gifs');
const GIF_CACHE_DIR = new File('./config/ChatTriggers/modules/V5Config/gif_cache');

if (!GIF_SOURCE_DIR.exists()) GIF_SOURCE_DIR.mkdirs();
if (!GIF_CACHE_DIR.exists()) GIF_CACHE_DIR.mkdirs();

class GIFOverlay extends ModuleBase {
    constructor() {
        super({
            name: 'GIF Overlay',
            subcategory: 'Visuals',
            description: 'Display animated GIFs on your screen',
            tooltip: 'Use /gif to change GIF overlays. Open chat to move/resize.',
        });

        this.state = {
            visible: false,
            posX: 100,
            posY: 100,
            scale: 1,
            baseWidth: 64,
            baseHeight: 64,
            lastTimestamp: Date.now(),
            accMs: 0,
            frameIndex: 0,
            selectedName: null,
            framePaths: [],
            delaysMs: [],
            dragging: false,
            scaling: false,
            dragOffsetX: 0,
            dragOffsetY: 0,
            initialScale: 1,
            initialMouseX: 0,
        };

        this.on('renderOverlay', () => this.render());
        this.on('clicked', (x, y, button, isPressed) => this.handleClick(x, y, button, isPressed));
        this.on('dragged', (dx, dy, x, y, button) => this.handleDrag(dx, dy, x, y, button));
        register('command', (...args) => this.handleCommand(args)).setName('gif');
    }

    isChatOpen() {
        const gui = Client.currentGui.get();
        if (!gui) return false;
        return gui.class.simpleName == 'class_408';
    }

    handleCommand(args) {
        const sub = (args[0] || 'help').toLowerCase();
        switch (sub) {
            case 'list':
                this.listGifs();
                break;
            case 'pick':
                this.pickGif(args[1]);
                break;
            case 'toggle':
                this.toggleVisibility();
                break;
            default:
                this.showHelp();
        }
    }

    listGifs() {
        const gifs = this.getGifFiles();
        if (gifs.length === 0) {
            Chat.message('&c[GIF] No .gif files found in &econfig/ChatTriggers/modules/V5Config/gifs');
            return;
        }
        Chat.message('&b[GIF] Select a GIF by running &e/gif pick <index>');
        gifs.forEach((file, i) => Chat.message(`&7[${i}] &f${file.getName()}`));
    }

    pickGif(indexStr) {
        const gifs = this.getGifFiles();
        if (gifs.length === 0) {
            Chat.message('&c[GIF] No .gif files found');
            return;
        }
        const idx = parseInt(indexStr, 10);
        if (isNaN(idx) || idx < 0 || idx >= gifs.length) {
            Chat.message('&c[GIF] Usage: /gif pick <index>');
            this.listGifs();
            return;
        }
        if (this.loadGif(String(gifs[idx].getName()))) {
            Chat.message('&a[GIF] Selected &f' + gifs[idx].getName());
        }
    }

    toggleVisibility() {
        this.state.visible = !this.state.visible;
        Chat.message(`&b[GIF] ${this.state.visible ? 'Shown' : 'Hidden'}.`);
    }

    showHelp() {
        Chat.message('&bGIF Overlay Help\n&e/gif list &7- Lists GIFs\n&e/gif pick <index> &7- Load a GIF\n&e/gif toggle &7- Toggle visibility');
    }

    getGifFiles() {
        const files = GIF_SOURCE_DIR.listFiles();
        if (!files) return [];
        return Array.from(files).filter((f) => f.isFile() && String(f.getName()).toLowerCase().endsWith('.gif'));
    }

    getCacheDir(baseName) {
        const dir = new File(GIF_CACHE_DIR, baseName);
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    readMeta(baseName) {
        try {
            const metaStr = FileLib.read('V5Config', `gif_cache/${baseName}/meta.json`);
            return metaStr ? JSON.parse(metaStr) : null;
        } catch (e) {
            return null;
        }
    }

    writeMeta(baseName, metaObj) {
        try {
            FileLib.write('V5Config', `gif_cache/${baseName}/meta.json`, JSON.stringify(metaObj, null, 2));
        } catch (e) {}
    }

    extractGifToCache(gifFile) {
        const name = String(gifFile.getName());
        const baseName = name.replace(/\.gif$/i, '');
        const outDir = this.getCacheDir(baseName);

        const meta = this.readMeta(baseName);
        if (meta && outDir.exists()) {
            const pngs = outDir.listFiles();
            if (pngs) {
                const pngCount = Array.from(pngs).filter((f) => String(f.getName()).endsWith('.png')).length;
                if (pngCount === meta.frameCount) return meta;
            }
        }

        const stream = ImageIO.createImageInputStream(gifFile);
        const readers = ImageIO.getImageReadersByFormatName('gif');
        if (!readers.hasNext()) {
            stream.close();
            throw new Error('No GIF reader');
        }
        const reader = readers.next();
        reader.setInput(stream, false);

        const numFrames = reader.getNumImages(true);
        const delays = [];
        const firstImage = reader.read(0);
        const width = firstImage.getWidth();
        const height = firstImage.getHeight();

        const masterCanvas = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        const graphics = masterCanvas.createGraphics();
        graphics.setBackground(new Color(0, 0, 0, 0));

        for (let i = 0; i < numFrames; i++) {
            const frameImage = reader.read(i);
            const frameMeta = reader.getImageMetadata(i);
            const root = frameMeta.getAsTree('javax_imageio_gif_image_1.0');
            let delayMs = 100,
                disposal = 'none',
                x = 0,
                y = 0;

            const gceNodes = root.getElementsByTagName('GraphicControlExtension');
            if (gceNodes && gceNodes.getLength() > 0) {
                const gce = gceNodes.item(0);
                disposal = gce.getAttribute('disposalMethod');
                const d = parseInt(gce.getAttribute('delayTime'), 10);
                if (!isNaN(d)) delayMs = Math.max(20, d * 10);
            }
            delays.push(delayMs);

            const idNodes = root.getElementsByTagName('ImageDescriptor');
            if (idNodes && idNodes.getLength() > 0) {
                const id = idNodes.item(0);
                x = parseInt(id.getAttribute('imageLeftPosition'), 10);
                y = parseInt(id.getAttribute('imageTopPosition'), 10);
            }

            graphics.drawImage(frameImage, x, y, null);
            ImageIO.write(masterCanvas, 'png', new File(outDir, `frame_${i}.png`));

            if (disposal === 'restoreToBackgroundColor') {
                graphics.setComposite(AlphaComposite.Clear);
                graphics.fillRect(x, y, frameImage.getWidth(), frameImage.getHeight());
                graphics.setComposite(AlphaComposite.SrcOver);
            }
        }

        graphics.dispose();
        stream.close();
        reader.dispose();

        const outMeta = { frameCount: numFrames, delaysMs: delays, width, height };
        this.writeMeta(baseName, outMeta);
        return outMeta;
    }

    loadGif(name) {
        const file = new File(GIF_SOURCE_DIR, name);
        if (!file.exists()) {
            Chat.message('&c[GIF] File not found: &f' + name);
            return false;
        }

        let meta;
        try {
            meta = this.extractGifToCache(file);
        } catch (e) {
            Chat.message('&c[GIF] Failed to decode: &f' + e);
            return false;
        }

        const baseName = name.replace(/\.gif$/i, '');
        const dir = this.getCacheDir(baseName);
        const paths = [];

        for (let i = 0; i < meta.frameCount; i++) {
            const frameFile = new File(dir, `frame_${i}.png`);
            if (frameFile.exists()) {
                paths.push(frameFile.getAbsolutePath());
            }
        }

        if (paths.length === 0) {
            Chat.message('&c[GIF] No frames loaded for: &f' + name);
            return false;
        }

        this.state.selectedName = name;
        this.state.framePaths = paths;
        this.state.delaysMs = meta.delaysMs;
        this.state.baseWidth = meta.width;
        this.state.baseHeight = meta.height;
        this.state.frameIndex = 0;
        this.state.accMs = 0;
        this.state.lastTimestamp = Date.now();
        this.state.visible = true;

        return true;
    }

    render() {
        if (!this.state.visible || this.state.framePaths.length === 0) return;

        const now = Date.now();
        const dt = now - this.state.lastTimestamp;
        this.state.lastTimestamp = now;

        this.state.accMs += dt;
        const currentDelay = this.state.delaysMs[this.state.frameIndex] || 100;
        while (this.state.accMs >= currentDelay) {
            this.state.accMs -= currentDelay;
            this.state.frameIndex = (this.state.frameIndex + 1) % this.state.framePaths.length;
        }

        const drawW = Math.max(1, Math.round(this.state.baseWidth * this.state.scale));
        const drawH = Math.max(1, Math.round(this.state.baseHeight * this.state.scale));
        const x = Math.round(this.state.posX);
        const y = Math.round(this.state.posY);

        NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());

        drawImage(this.state.framePaths[this.state.frameIndex], x, y, drawW, drawH);

        if (this.isChatOpen()) {
            this.drawMoveUI(x, y, drawW, drawH);
        }

        NVG.endFrame();
    }

    drawMoveUI(x, y, width, height) {
        const borderColor = new Color(1, 1, 1, 0.5).getRGB();
        const handleColor = new Color(0.3, 0.6, 1, 0.8).getRGB();
        const handleHoverColor = new Color(0.5, 0.7, 1, 1).getRGB();
        const cornerColor = new Color(1, 1, 1, 0.8).getRGB();

        NVG.drawRect(x - 2, y - 2, width + 4, 2, borderColor);
        NVG.drawRect(x - 2, y + height, width + 4, 2, borderColor);
        NVG.drawRect(x - 2, y, 2, height, borderColor);
        NVG.drawRect(x + width, y, 2, height, borderColor);

        const cs = 6,
            ct = 2;
        NVG.drawRect(x - 2, y - 2, cs, ct, cornerColor);
        NVG.drawRect(x - 2, y - 2, ct, cs, cornerColor);
        NVG.drawRect(x + width - cs + 2, y - 2, cs, ct, cornerColor);
        NVG.drawRect(x + width, y - 2, ct, cs, cornerColor);
        NVG.drawRect(x - 2, y + height, cs, ct, cornerColor);
        NVG.drawRect(x - 2, y + height - cs + 2, ct, cs, cornerColor);

        const hs = 14;
        const hx = x + width - hs,
            hy = y + height - hs;
        const mx = Client.getMouseX(),
            my = Client.getMouseY();
        const isHovering = this.isInside(mx, my, hx, hy, hs, hs);
        const hc = isHovering || this.state.scaling ? handleHoverColor : handleColor;

        NVG.drawRect(hx, hy, hs, hs, hc);
        NVG.drawRect(hx, hy, hs, 1, borderColor);
        NVG.drawRect(hx, hy, 1, hs, borderColor);

        const ic = new Color(1, 1, 1, 0.9).getRGB();
        for (let i = 0; i < 4; i++) {
            const off = i * 3 + 3,
                len = hs - off - 2;
            NVG.drawRect(hx + off, hy + hs - 3, len, 1, ic);
            NVG.drawRect(hx + hs - 3, hy + off, 1, len, ic);
        }
    }

    isInside(mx, my, x, y, w, h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    handleClick(x, y, button, isPressed) {
        if (!this.state.visible || !this.isChatOpen() || button !== 0) return;

        if (isPressed) {
            const dw = Math.max(1, Math.round(this.state.baseWidth * this.state.scale));
            const dh = Math.max(1, Math.round(this.state.baseHeight * this.state.scale));
            const px = Math.round(this.state.posX),
                py = Math.round(this.state.posY);
            const hs = 14;

            if (this.isInside(x, y, px + dw - hs, py + dh - hs, hs, hs)) {
                this.state.scaling = true;
                this.state.initialScale = this.state.scale;
                this.state.initialMouseX = x;
                return;
            }

            if (this.isInside(x, y, px, py, dw, dh)) {
                this.state.dragging = true;
                this.state.dragOffsetX = x - this.state.posX;
                this.state.dragOffsetY = y - this.state.posY;
            }
        } else {
            this.state.dragging = false;
            this.state.scaling = false;
        }
    }

    handleDrag(dx, dy, x, y, button) {
        if (!this.state.visible || !this.isChatOpen() || button !== 0) return;

        if (this.state.dragging) {
            this.state.posX = x - this.state.dragOffsetX;
            this.state.posY = y - this.state.dragOffsetY;
        } else if (this.state.scaling) {
            const initialDrawW = this.state.baseWidth * this.state.initialScale;
            const newDrawW = initialDrawW + (x - this.state.initialMouseX);
            this.state.scale = Math.max(0.1, Math.min(newDrawW / this.state.baseWidth, 10));
        }
    }
}

new GIFOverlay();
