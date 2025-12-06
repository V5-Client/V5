import { ModuleBase } from '../../utils/ModuleBase';
import { File, Color } from '../../utils/Constants';
import { Chat } from '../../utils/Chat';

const ImageIO = Java.type('javax.imageio.ImageIO');
const BufferedImage = Java.type('java.awt.image.BufferedImage');
const AlphaComposite = Java.type('java.awt.AlphaComposite');

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
            frames: [],
            delaysMs: [],
            dragging: false,
            scaling: false,
            dragOffsetX: 0,
            dragOffsetY: 0,
            initialScale: 1,
            initialMouseX: 0,
        };

        // Registers always active cuz idgaf
        this.on('renderOverlay', () => this.render());
        this.on('clicked', (x, y, button, isPressed) => this.handleClick(x, y, button, isPressed));
        this.on('dragged', (dx, dy, x, y, button) => this.handleDrag(dx, dy, x, y, button));
        register('command', (...args) => this.handleCommand(args)).setName('gif');
    }

    isChatOpen() {
        const gui = Client.currentGui.get();
        if (!gui) return false;
        const className = gui.class.simpleName;
        return className == 'class_408';
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
        gifs.forEach((file, i) => {
            Chat.message(`&7[${i}] &f${file.getName()}`);
        });
    }

    pickGif(indexStr) {
        const gifs = this.getGifFiles();
        if (gifs.length === 0) {
            Chat.message('&c[GIF] No .gif files found in &econfig/ChatTriggers/modules/V5Config/gifs');
            return;
        }
        const idx = parseInt(indexStr, 10);
        if (isNaN(idx) || idx < 0 || idx >= gifs.length) {
            Chat.message('&c[GIF] Usage: /gif pick <index>');
            this.listGifs();
            return;
        }
        const file = gifs[idx];
        if (this.loadGif(String(file.getName()))) {
            Chat.message('&a[GIF] Selected &f' + file.getName());
        }
    }

    toggleVisibility() {
        this.state.visible = !this.state.visible;
        Chat.message(`&b[GIF] ${this.state.visible ? 'Shown' : 'Hidden'}.`);
    }

    showHelp() {
        Chat.message(
            '&bGIF Overlay Help\n' +
                '&e/gif list &7- &fLists available GIFs.\n' +
                '&e/gif pick <index> &7- &fLoads a GIF from the list.\n' +
                '&e/gif toggle &7- &fToggles GIF visibility.\n' +
                '&e/gif help &7- &fShows this message.'
        );
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
            if (!metaStr) return null;
            return JSON.parse(metaStr);
        } catch (e) {
            return null;
        }
    }

    writeMeta(baseName, metaObj) {
        try {
            const json = JSON.stringify(metaObj, null, 2);
            FileLib.write('V5Config', `gif_cache/${baseName}/meta.json`, json);
        } catch (e) {}
    }

    extractGifToCache(gifFile) {
        const name = String(gifFile.getName());
        const baseName = name.replace(/\.gif$/i, '');
        const outDir = this.getCacheDir(baseName);

        // Check if cached
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
            throw new Error('No GIF reader available');
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
            let delayMs = 100;
            let disposal = 'none';
            let x = 0;
            let y = 0;

            // Take the frame delay
            const gceNodes = root.getElementsByTagName('GraphicControlExtension');
            if (gceNodes && gceNodes.getLength() > 0) {
                const gce = gceNodes.item(0);
                disposal = gce.getAttribute('disposalMethod');
                const d = parseInt(gce.getAttribute('delayTime'), 10);
                if (!isNaN(d)) delayMs = Math.max(20, d * 10);
            }
            delays.push(delayMs);

            // Take the position from the image descriptor
            const idNodes = root.getElementsByTagName('ImageDescriptor');
            if (idNodes && idNodes.getLength() > 0) {
                const id = idNodes.item(0);
                x = parseInt(id.getAttribute('imageLeftPosition'), 10);
                y = parseInt(id.getAttribute('imageTopPosition'), 10);
            }

            // Draw the frame
            graphics.drawImage(frameImage, x, y, null);
            ImageIO.write(masterCanvas, 'png', new File(outDir, `frame_${i}.png`));

            // Handle the disposal for the next frame
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
            Chat.message('&c[GIF] Failed to decode GIF: &f' + e);
            console.log(e.toString() + '\n' + e.getStackTrace().join('\n'));
            return false;
        }

        const baseName = name.replace(/\.gif$/i, '');
        const dir = this.getCacheDir(baseName);
        const imgs = [];

        for (let i = 0; i < meta.frameCount; i++) {
            const frameFile = new File(dir, `frame_${i}.png`);
            try {
                imgs.push(Image.fromFile(frameFile));
            } catch (e) {
                console.log(`Failed to load frame ${i}: ${e}`);
            }
        }

        if (imgs.length === 0) {
            Chat.message('&c[GIF] No frames were loaded for: &f' + name);
            return false;
        }

        this.state.selectedName = name;
        this.state.frames = imgs;
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
        if (!this.state.visible || this.state.frames.length === 0) return;

        const now = Date.now();
        const dt = now - this.state.lastTimestamp;
        this.state.lastTimestamp = now;

        // Advance frame
        this.state.accMs += dt;
        const currentDelay = this.state.delaysMs[this.state.frameIndex] || 100;
        while (this.state.accMs >= currentDelay) {
            this.state.accMs -= currentDelay;
            this.state.frameIndex = (this.state.frameIndex + 1) % this.state.frames.length;
        }

        const drawW = Math.max(1, Math.round(this.state.baseWidth * this.state.scale));
        const drawH = Math.max(1, Math.round(this.state.baseHeight * this.state.scale));
        const x = Math.round(this.state.posX);
        const y = Math.round(this.state.posY);

        // Draw current frame
        try {
            this.state.frames[this.state.frameIndex].draw(x, y, drawW, drawH);
        } catch (e) {
            console.log(`Failed to draw frame: ${e}`);
        }

        // Draw the movemode thing when chat is open
        if (this.isChatOpen()) {
            this.drawMoveUI(x, y, drawW, drawH);
        }
    }

    drawMoveUI(x, y, width, height) {
        const borderColor = new Color(1, 1, 1, 0.5).getRGB();
        const handleColor = new Color(0.3, 0.6, 1, 0.8).getRGB();
        const handleHoverColor = new Color(0.5, 0.7, 1, 1).getRGB();
        const cornerColor = new Color(1, 1, 1, 0.8).getRGB();

        // Edges of moveGUI cuz it looks cool
        Renderer.drawRect(borderColor, x - 2, y - 2, width + 4, 2); // Top
        Renderer.drawRect(borderColor, x - 2, y + height, width + 4, 2); // Bottom
        Renderer.drawRect(borderColor, x - 2, y, 2, height); // Left
        Renderer.drawRect(borderColor, x + width, y, 2, height); // Right

        // Corner markers cuz they look cool too
        const cornerSize = 6;
        const cornerThickness = 2;

        // Top left
        Renderer.drawRect(cornerColor, x - 2, y - 2, cornerSize, cornerThickness);
        Renderer.drawRect(cornerColor, x - 2, y - 2, cornerThickness, cornerSize);

        // Top right
        Renderer.drawRect(cornerColor, x + width - cornerSize + 2, y - 2, cornerSize, cornerThickness);
        Renderer.drawRect(cornerColor, x + width, y - 2, cornerThickness, cornerSize);

        // Bottom left
        Renderer.drawRect(cornerColor, x - 2, y + height, cornerSize, cornerThickness);
        Renderer.drawRect(cornerColor, x - 2, y + height - cornerSize + 2, cornerThickness, cornerSize);

        // Bottom right, this one is a resize handle
        const handleSize = 14;
        const handleX = x + width - handleSize;
        const handleY = y + height - handleSize;

        const mouseX = Client.getMouseX();
        const mouseY = Client.getMouseY();
        const isHovering = this.isInside(mouseX, mouseY, handleX, handleY, handleSize, handleSize);

        const currentHandleColor = isHovering || this.state.scaling ? handleHoverColor : handleColor;

        // Draw the resize handle with border
        Renderer.drawRect(currentHandleColor, handleX, handleY, handleSize, handleSize);
        Renderer.drawRect(borderColor, handleX, handleY, handleSize, 1); // Top
        Renderer.drawRect(borderColor, handleX, handleY, 1, handleSize); // Left

        // Draw resize icon arrow thingy
        const iconColor = new Color(1, 1, 1, 0.9).getRGB();
        for (let i = 0; i < 4; i++) {
            const offset = i * 3 + 3;
            const lineLen = handleSize - offset - 2;
            Renderer.drawRect(iconColor, handleX + offset, handleY + handleSize - 3, lineLen, 1);
            Renderer.drawRect(iconColor, handleX + handleSize - 3, handleY + offset, 1, lineLen);
        }
    }

    isInside(mouseX, mouseY, x, y, width, height) {
        return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
    }

    handleClick(x, y, button, isPressed) {
        if (!this.state.visible || !this.isChatOpen() || button !== 0) return;

        if (isPressed) {
            const drawW = Math.max(1, Math.round(this.state.baseWidth * this.state.scale));
            const drawH = Math.max(1, Math.round(this.state.baseHeight * this.state.scale));
            const posX = Math.round(this.state.posX);
            const posY = Math.round(this.state.posY);
            const handleSize = 14;

            if (this.isInside(x, y, posX + drawW - handleSize, posY + drawH - handleSize, handleSize, handleSize)) {
                this.state.scaling = true;
                this.state.initialScale = this.state.scale;
                this.state.initialMouseX = x;
                return;
            }

            if (this.isInside(x, y, posX, posY, drawW, drawH)) {
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
            const newScale = newDrawW / this.state.baseWidth;
            this.state.scale = Math.max(0.1, Math.min(newScale, 10)); // Clamp size between 0.1 and 10 cuz literally who would need anything outside this? 10 is GIANT way off screen and 0.1 isn't visible.
        }
    }
}

new GIFOverlay();
