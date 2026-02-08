import { ModuleBase } from '../../utils/ModuleBase';
import { ProcessBuilder, Scanner, InputStreamReader, Runtime, isWindows, NVG } from '../../utils/Constants';
import { Utils } from '../../utils/Utils';
import requestV2 from 'requestV2';
import {
    drawImageFromURL,
    THEME,
    colorWithAlpha,
    drawRoundedRectangleWithBorder,
    drawText,
    FontSizes,
    getTextWidth,
    CORNER_RADIUS,
    BORDER_WIDTH,
} from '../../gui/Utils';

class Music extends ModuleBase {
    constructor() {
        super({ name: 'Music Overlay', subcategory: 'Visuals' });

        this.musicProcess = null;
        this.mcDir = new java.io.File(Client.getMinecraft().runDirectory);
        this.assetsDir = new java.io.File(this.mcDir, 'config/ChatTriggers/modules/V5/assets');
        this.windowsExePath = 'WindowsMusicHelper.exe';
        this.exePath = new java.io.File(this.assetsDir, this.windowsExePath);

        this.data = null;
        this.lastSongTitle = '';
        this.lastSongTimeStr = '';
        this.interpolatedSeconds = 0;
        this.lastFrameTime = Date.now();
        this.ticksSinceSync = 0;

        this.positionConfig = Utils.getConfigFile('OverlayPositions/music_overlay.json') || {};
        const savedX = typeof this.positionConfig.x === 'number' ? this.positionConfig.x : 100;
        const savedY = typeof this.positionConfig.y === 'number' ? this.positionConfig.y : 100;

        this.x = savedX;
        this.y = savedY;
        this.dynamicWidth = 200;
        this.baseHeight = 90;

        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        this.addToggle('Draggable', (v) => (this.DRAGGABLE = v), 'Allows dragging of the overlay', false);
        this.addSlider('Scale', 0.5, 1.2, 1.0, (v) => (this.SCALE = v), 'Adjust the size of the overlay');

        this.on('step', () => {
            this.ticksSinceSync += 5;
            if (Client.getFPS() > 0) {
                this.getSongData();
            }
        }).setFps(4);

        this.on('renderOverlay', () => {
            if (!this.data || (this.data && this.data.song !== 'None')) {
                this.renderOverlay();
            }
        });

        this.on('clicked', (x, y, button, isPressed) => this.handleClick(x, y, button, isPressed));
        this.on('dragged', (dx, dy, x, y, button) => this.handleDrag(dx, dy, x, y, button));

        register('worldUnload', () => this.stopWindowsProgram());
        register('gameUnload', () => this.savePosition());
        register('guiClosed', () => this.savePosition());
        Runtime.getRuntime().addShutdownHook(new java.lang.Thread(() => this.stopWindowsProgram()));
        this.onDisable(() => {
            this.savePosition();
            this.stopWindowsProgram();
        });
    }

    parseTimeToSeconds(timeStr) {
        if (!timeStr || !timeStr.includes(':')) return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    formatSecondsToTime(seconds) {
        const s = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins + ':' + (secs < 10 ? '0' + secs : secs);
    }

    isChatOpen() {
        const gui = Client.currentGui.get();
        if (!gui) return false;
        return gui.class.simpleName == 'class_408';
    }

    isInside(mx, my, x, y, w, h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    handleClick(x, y, button, isPressed) {
        if (!this.DRAGGABLE || !this.isChatOpen() || button !== 0) return;

        const scale = Client.getMinecraft().getWindow().getScaleFactor();
        const mx = x / scale;
        const my = y / scale;

        if (isPressed) {
            if (this.isInside(mx, my, this.x, this.y, this.dynamicWidth, this.baseHeight)) {
                this.isDragging = true;
                this.dragOffset.x = mx - this.x;
                this.dragOffset.y = my - this.y;
            }
        } else {
            if (this.isDragging) {
                this.isDragging = false;
                this.savePosition();
            }
        }
    }

    handleDrag(dx, dy, x, y, button) {
        if (!this.DRAGGABLE || !this.isChatOpen() || button !== 0 || !this.isDragging) return;

        const scale = Client.getMinecraft().getWindow().getScaleFactor();
        const mx = x / scale;
        const my = y / scale;

        const screenW = Renderer.screen.getWidth();
        const screenH = Renderer.screen.getHeight();

        const newX = mx - this.dragOffset.x;
        const newY = my - this.dragOffset.y;

        this.x = Math.max(0, Math.min(newX, screenW - this.dynamicWidth));
        this.y = Math.max(0, Math.min(newY, screenH - this.baseHeight));
    }

    savePosition() {
        this.positionConfig = {
            x: this.x,
            y: this.y,
        };
        Utils.writeConfigFile('OverlayPositions/music_overlay.json', this.positionConfig);
    }

    renderOverlay() {
        const now = Date.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();

        const isSkeleton = !this.data;
        const songName = isSkeleton ? 'Searching for Media...' : this.data.song || 'Unknown Title';
        const imageURL = isSkeleton || !this.data.art || this.data.art.toLowerCase() === 'none' ? '' : this.data.art;

        const timeMax = isSkeleton ? '--:--' : this.data.totalTime || '0:00';
        const isPaused = isSkeleton ? true : !!this.data.isPaused;

        let interpolatedTimeText = '--:--';
        let progress = 0;

        if (!isSkeleton) {
            const totalSec = this.parseTimeToSeconds(timeMax);
            const serverSec = this.parseTimeToSeconds(this.data.time || '0:00');

            if (this.data.song !== this.lastSongTitle) {
                this.interpolatedSeconds = serverSec;
                this.lastSongTitle = this.data.song;
                this.ticksSinceSync = 0;
            }

            const drift = Math.abs(this.interpolatedSeconds - serverSec);
            const serverUpdated = this.data.time !== this.lastSongTimeStr;

            if (serverUpdated) {
                this.interpolatedSeconds = serverSec;
                this.lastSongTimeStr = this.data.time;
            } else if (drift > 8) {
                this.interpolatedSeconds = serverSec;
            } else if (this.ticksSinceSync > 200) {
                this.interpolatedSeconds = serverSec;
                this.ticksSinceSync = 0;
            } else {
                if (!isPaused && totalSec > 0 && this.interpolatedSeconds < totalSec) {
                    this.interpolatedSeconds += deltaTime;
                }
            }

            interpolatedTimeText = this.formatSecondsToTime(this.interpolatedSeconds);
            progress = totalSec > 0 ? Math.min(this.interpolatedSeconds / totalSec, 1) : 0;
        }

        // Layout Constants
        const s = this.SCALE || 1.0;
        const padding = 12 * s;
        const imageSize = 55 * s;
        const titleFontSize = FontSizes.MEDIUM * 1.3 * s;
        const timerFontSize = FontSizes.MEDIUM * 0.85 * s;
        const barHeight = 4 * s;

        // Dynamic width calculation
        const nameWidth = getTextWidth(songName, titleFontSize);
        const minWidth = 200 * s;
        this.dynamicWidth = Math.max(minWidth, nameWidth + imageSize + padding * 4);
        this.baseHeight = 90 * s;

        const titleColor = isSkeleton ? 0xaaaaaaff : 0xffffffff;
        const timeColor = isSkeleton ? 0x888888ff : 0xccffffff;

        try {
            NVG.beginFrame(sw, sh);

            drawRoundedRectangleWithBorder({
                x: this.x,
                y: this.y,
                width: this.dynamicWidth,
                height: this.baseHeight,
                radius: CORNER_RADIUS * s,
                color: colorWithAlpha(THEME.OV_WINDOW, 0.95),
                borderWidth: BORDER_WIDTH * s,
                borderColor: colorWithAlpha(THEME.OV_BORDER, 0.7),
            });

            const imgX = this.x + this.dynamicWidth - imageSize - padding;
            const imgY = this.y + padding;

            if (imageURL.length > 5) {
                drawImageFromURL(imageURL, imgX, imgY, imageSize, imageSize);
            } else {
                drawRoundedRectangleWithBorder({
                    x: imgX,
                    y: imgY,
                    width: imageSize,
                    height: imageSize,
                    radius: CORNER_RADIUS * s,
                    color: colorWithAlpha(0x000000, 0.3),
                    borderWidth: 0,
                    borderColor: 0,
                });

                const qText = isSkeleton ? '...' : '?';
                const qSize = titleFontSize;
                const qWidth = getTextWidth(qText, qSize);
                drawText(qText, imgX + imageSize / 2 - qWidth / 2, imgY + imageSize / 2 - qSize / 2.5, qSize, 0xaaaaaaff, 16);
            }

            drawText(songName, this.x + padding, this.y + padding + titleFontSize, titleFontSize, titleColor, 16);

            const curTimeWidth = getTextWidth(interpolatedTimeText, timerFontSize);
            const maxTimeWidth = getTextWidth(timeMax, timerFontSize);
            const textToBarGap = 4 * s;

            const barStartX = this.x + padding + curTimeWidth + textToBarGap;
            const barEndX = this.x + this.dynamicWidth - padding - maxTimeWidth - textToBarGap;
            const barWidth = barEndX - barStartX;

            const barY = this.y + this.baseHeight - padding - barHeight * 0.8;
            const timerY = barY + barHeight / 2 - timerFontSize / 2.5;

            drawText(interpolatedTimeText, this.x + padding, timerY + timerFontSize / 2.5, timerFontSize, timeColor, 16);
            drawText(timeMax, this.x + this.dynamicWidth - padding - maxTimeWidth, timerY + timerFontSize / 2.5, timerFontSize, timeColor, 16);

            drawRoundedRectangleWithBorder({
                x: barStartX,
                y: barY,
                width: barWidth,
                height: barHeight,
                radius: barHeight / 2,
                color: colorWithAlpha(0xffffff, 0.15),
                borderWidth: 0,
                borderColor: 0,
            });

            if (progress > 0) {
                drawRoundedRectangleWithBorder({
                    x: barStartX,
                    y: barY,
                    width: Math.max(0, barWidth * progress),
                    height: barHeight,
                    radius: barHeight / 2,
                    color: colorWithAlpha(0xffffff, 1.0),
                    borderWidth: 0,
                    borderColor: 0,
                });
            }
        } catch (e) {
        } finally {
            NVG.endFrame();
        }
    }

    fetchWindowsData() {
        requestV2({
            url: 'http://localhost:61942/',
            method: 'GET',
            timeout: 150,
            json: true,
        })
            .then((res) => {
                this.data = res;
            })
            .catch((e) => {
                // would only really happen if it wasn't running. TODO: restart program
            });
    }

    getSongData() {
        if (isWindows) {
            this.exePath = new java.io.File(this.assetsDir, this.windowsExePath);
            if (!this.checkWindowsProgram()) this.runWindowsProgram();
            this.fetchWindowsData();
        }
    }

    checkWindowsProgram() {
        return this.musicProcess !== null && this.musicProcess.isAlive();
    }

    runWindowsProgram() {
        const file = new java.io.File(this.exePath);
        if (!file.exists()) return;

        new Thread(() => {
            try {
                const pb = new ProcessBuilder(this.exePath.getAbsolutePath());
                pb.directory(new java.io.File(this.assetsDir));
                this.musicProcess = pb.start();
                const sc = new Scanner(new InputStreamReader(this.musicProcess.getInputStream()));
                while (this.musicProcess !== null && this.musicProcess.isAlive()) {
                    if (sc.hasNextLine()) sc.nextLine();
                    Thread.sleep(500);
                }
            } catch (e) {
                console.error(`[Music] Start error: ${e}`);
            }
        }).start();
    }

    stopWindowsProgram() {
        if (this.musicProcess !== null) {
            this.musicProcess.destroyForcibly();
            this.musicProcess = null;
        }
        try {
            java.lang.Runtime.getRuntime().exec(`taskkill /F /IM ${this.windowsExePath}`);
        } catch (e) {}
    }
}

new Music();
