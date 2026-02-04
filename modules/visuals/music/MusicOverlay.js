import { ModuleBase } from '../../../utils/ModuleBase';
import { System, ProcessBuilder, Scanner, InputStreamReader, StandardCharsets, Runtime, isWindows, isMac, isLinux, NVG } from '../../../utils/Constants';
import requestV2 from 'requestV2';
import { Chat } from '../../../utils/Chat';
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
} from '../../../gui/Utils';

class Music extends ModuleBase {
    constructor() {
        super({ name: 'Music', subcategory: 'Visuals' });

        this.musicProcess = null;
        this.mcDir = new java.io.File(Client.getMinecraft().runDirectory);
        this.assetsDir = new java.io.File(this.mcDir, 'config/ChatTriggers/modules/V5/Modules/Visuals/Music');
        this.exePath = null;
        this.windowsExePath = 'WindowsMusic.exe';

        this.data = null;
        this.lastSongTime = '';
        this.interpolatedSeconds = 0;
        this.lastFrameTime = Date.now();

        this.x = 100;
        this.y = 100;
        this.dynamicWidth = 200;
        this.baseHeight = 90;

        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };

        this.addToggle('Draggable', (v) => (this.DRAGGABLE = v), 'Allows dragging of the overlay', false);
        this.addSlider('Scale', 0.5, 2.0, 1.0, (v) => (this.SCALE = v), 'Adjust the size of the overlay');

        this.on('tick', () => {
            if (Client.getFPS() % 5 === 0) {
                this.getSongData();
            }
        });

        this.on('renderOverlay', () => {
            if (this.data && this.data.song && this.data.song !== 'None') {
                this.renderOverlay();
            }
        });

        this.when(
            () => this.DRAGGABLE,
            'guiMouseClick',
            (mx, my, button) => {
                if (button !== 0) return;

                if (mx >= this.x && mx <= this.x + this.dynamicWidth && my >= this.y && my <= this.y + this.baseHeight) {
                    this.isDragging = true;
                    this.dragOffset.x = mx - this.x;
                    this.dragOffset.y = my - this.y;
                }
            }
        );

        this.when(
            () => this.DRAGGABLE && this.isDragging,
            'guiMouseDrag',
            (mx, my) => {
                this.x = mx - this.dragOffset.x;
                this.y = my - this.dragOffset.y;
            }
        );

        this.when(
            () => this.isDragging,
            'clicked',
            (mx, my, button, pressed) => {
                if (!pressed && button === 0) this.isDragging = false;
            }
        );

        // is this needed ?
        register('worldUnload', () => this.stopWindowsProgram());
        Runtime.getRuntime().addShutdownHook(new java.lang.Thread(() => this.stopWindowsProgram()));
        this.onDisable(() => this.stopWindowsProgram());
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

    renderOverlay() {
        const now = Date.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();

        const songName = this.data.song || 'Unknown Title';
        const imageURL = this.data.art || '';
        const timeMax = this.data.totalTime || '0:00';

        const isPaused = !!this.data.isPaused;

        const totalSec = this.parseTimeToSeconds(timeMax);
        const serverSec = this.parseTimeToSeconds(this.data.time || '0:00');

        if (this.data.time !== this.lastSongTime) {
            this.interpolatedSeconds = serverSec;
            this.lastSongTime = this.data.time;
        } else if (!isPaused && totalSec > 0 && this.interpolatedSeconds < totalSec) {
            this.interpolatedSeconds += deltaTime;
        }

        const interpolatedTimeText = this.formatSecondsToTime(this.interpolatedSeconds);
        const progress = totalSec > 0 ? Math.min(this.interpolatedSeconds / totalSec, 1) : 0;

        const s = this.SCALE || 1.0;
        const padding = 12 * s;
        const imageSize = 55 * s;
        const titleFontSize = FontSizes.MEDIUM * 1.3 * s;
        const timerFontSize = FontSizes.MEDIUM * 0.85 * s;
        const barHeight = 4 * s;

        const nameWidth = getTextWidth(songName, titleFontSize);

        this.dynamicWidth = nameWidth + imageSize + padding * 4;
        this.baseHeight = 90 * s;

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

            if (imageURL) {
                drawImageFromURL(imageURL, this.x + this.dynamicWidth - imageSize - padding, this.y + padding, imageSize, imageSize);
            }

            drawText(songName, this.x + padding, this.y + padding + titleFontSize, titleFontSize, 0xffffffff, 16);

            const curTimeWidth = getTextWidth(interpolatedTimeText, timerFontSize);
            const maxTimeWidth = getTextWidth(timeMax, timerFontSize);
            const textToBarGap = 4 * s;

            const barStartX = this.x + padding + curTimeWidth + textToBarGap;
            const barEndX = this.x + this.dynamicWidth - padding - maxTimeWidth - textToBarGap;
            const barWidth = barEndX - barStartX;

            const barY = this.y + this.baseHeight - padding - barHeight * 0.8;
            const timerY = barY + barHeight / 2 - timerFontSize / 2.5;

            drawText(interpolatedTimeText, this.x + padding, timerY + timerFontSize / 2.5, timerFontSize, 0xccffffff, 16);
            drawText(timeMax, this.x + this.dynamicWidth - padding - maxTimeWidth, timerY + timerFontSize / 2.5, timerFontSize, 0xccffffff, 16);

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
            .catch(() => {
                if (this.data) this.data.song = 'None';
            });
    }

    getSongData() {
        if (isWindows) {
            this.exePath = new java.io.File(this.assetsDir, this.windowsExePath);
            if (!this.checkWindowsProgram()) this.runWindowsProgram();
            this.fetchWindowsData();
        } // else if linux else if macos etc
    }

    checkWindowsProgram() {
        // idk if this is 100% reliable
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
