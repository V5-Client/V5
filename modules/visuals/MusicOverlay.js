import requestV2 from 'requestV2';
import {
    BORDER_WIDTH,
    colorWithAlpha,
    CORNER_RADIUS,
    drawImageFromURL,
    drawRoundedRectangleWithBorder,
    drawText,
    FontSizes,
    getTextWidth,
    THEME,
} from '../../gui/Utils';
import { InputStreamReader, isWindows, NVG, ProcessBuilder, Runtime, Scanner } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';

class Music extends ModuleBase {
    constructor() {
        super({ name: 'Music Overlay', subcategory: 'Visuals' });

        this.musicProcess = null;
        this.mcDir = new java.io.File(Client.getMinecraft().runDirectory);
        this.assetsDir = new java.io.File(this.mcDir, 'config/ChatTriggers/assets/');
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
        const savedScale = typeof this.positionConfig.scale === 'number' ? this.positionConfig.scale : 1.0;

        this.x = savedX;
        this.y = savedY;
        this.scale = Math.max(0.5, Math.min(3.0, savedScale));
        this.dynamicWidth = 200;
        this.baseHeight = 90;

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
        return Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10);
    }

    formatSecondsToTime(seconds) {
        const s = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins + ':' + (secs < 10 ? '0' + secs : secs);
    }

    savePosition() {
        this.syncFromOverlayEditor();
        this.positionConfig = {
            x: this.x,
            y: this.y,
            scale: this.scale,
        };
        Utils.writeConfigFile('OverlayPositions/music_overlay.json', this.positionConfig);
    }

    syncFromOverlayEditor() {
        const latest = Utils.getConfigFile('OverlayPositions/music_overlay.json');
        if (!latest || typeof latest !== 'object') return;

        if (typeof latest.x === 'number') this.x = latest.x;
        if (typeof latest.y === 'number') this.y = latest.y;
        if (typeof latest.scale === 'number') this.scale = Math.max(0.5, Math.min(3.0, latest.scale));

        this.positionConfig = latest;
    }

    renderOverlay() {
        this.syncFromOverlayEditor();

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

        const s = this.scale || 1.0;
        const padding = 12 * s;
        const imageSize = 55 * s;
        const titleFontSize = FontSizes.MEDIUM * 1.3 * s;
        const timerFontSize = FontSizes.MEDIUM * 0.85 * s;
        const barHeight = 4 * s;

        const nameWidth = getTextWidth(songName, titleFontSize);
        const minWidth = 200 * s;
        this.dynamicWidth = Math.max(minWidth, nameWidth + imageSize + padding * 4);
        this.baseHeight = 90 * s;

        const overflowRight = Math.max(0, this.x + this.dynamicWidth - sw);
        const overlayX = Math.max(0, this.x - overflowRight);

        const titleColor = isSkeleton ? 0xaaaaaaff : 0xffffffff;
        const timeColor = isSkeleton ? 0x888888ff : 0xccffffff;
        const bg = colorWithAlpha(THEME.OV_WINDOW, 0.92);
        const border = colorWithAlpha(THEME.OV_ACCENT, 0.35);

        try {
            NVG.beginFrame(sw, sh);

            drawRoundedRectangleWithBorder({
                x: overlayX,
                y: this.y,
                width: this.dynamicWidth,
                height: this.baseHeight,
                radius: CORNER_RADIUS * 0.6 * s,
                color: bg,
                borderWidth: BORDER_WIDTH * s,
                borderColor: border,
            });

            const imgX = overlayX + this.dynamicWidth - imageSize - padding;
            const imgY = this.y + padding;

            if (imageURL.length > 5) {
                drawImageFromURL(imageURL, imgX, imgY, imageSize, imageSize, 6);
            } else {
                drawRoundedRectangleWithBorder({
                    x: imgX,
                    y: imgY,
                    width: imageSize,
                    height: imageSize,
                    radius: CORNER_RADIUS * 0.5 * s,
                    color: colorWithAlpha(0x000000, 0.3),
                    borderWidth: 0,
                    borderColor: 0,
                });

                const qText = isSkeleton ? '...' : '?';
                const qSize = titleFontSize;
                const qWidth = getTextWidth(qText, qSize);
                drawText(qText, imgX + imageSize / 2 - qWidth / 2, imgY + imageSize / 2 - qSize / 2.5, qSize, 0xaaaaaaff, 16);
            }

            drawText(songName, overlayX + padding, this.y + padding + titleFontSize, titleFontSize, titleColor, 16);

            const curTimeWidth = getTextWidth(interpolatedTimeText, timerFontSize);
            const maxTimeWidth = getTextWidth(timeMax, timerFontSize);
            const textToBarGap = 4 * s;

            const barStartX = overlayX + padding + curTimeWidth + textToBarGap;
            const barEndX = overlayX + this.dynamicWidth - padding - maxTimeWidth - textToBarGap;
            const barWidth = barEndX - barStartX;

            const barY = this.y + this.baseHeight - padding - barHeight * 0.8;
            const timerY = barY + barHeight / 2 - timerFontSize / 2.5;

            drawText(interpolatedTimeText, overlayX + padding, timerY + timerFontSize / 2.5, timerFontSize, timeColor, 16);
            drawText(timeMax, overlayX + this.dynamicWidth - padding - maxTimeWidth, timerY + timerFontSize / 2.5, timerFontSize, timeColor, 16);

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
