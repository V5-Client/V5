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
import { File, InputStreamReader, isWindows, NVG, ProcessBuilder, Runtime, Scanner, globalAssetsDir, OS, isLinux, isMac } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { OverlayManager } from '../../gui/OverlayUtils';
import { Chat } from '../../utils/Chat';

class Music extends ModuleBase {
    constructor() {
        super({ name: 'Music Overlay', subcategory: 'Visuals' });

        this.musicProcess = null;
        this.assetsDir = globalAssetsDir.getAbsoluteFile();
        this.executableBase = 'MusicHelper';
        this.executable = null;
        this.data = null;
        this.lastDataReceivedAt = 0;
        this.lastRestartAttempt = 0;
        this.getCorrectBinary();
        this.runBinary();
        this.positionConfig = Utils.getConfigFile('OverlayPositions/music_overlay.json') || {};
        const savedX = typeof this.positionConfig.x === 'number' ? this.positionConfig.x : 100;
        const savedY = typeof this.positionConfig.y === 'number' ? this.positionConfig.y : 100;
        const savedScale = typeof this.positionConfig.scale === 'number' ? this.positionConfig.scale : 1.0;
        this.x = savedX;
        this.y = savedY;
        this.scale = Math.max(0.5, Math.min(3.0, savedScale));
        this.dynamicWidth = 200;
        this.baseHeight = 90;
        this.addShutdownHook();
        this.on('step', () => {
            if (Client.getFPS() > 0) {
                this.fetchData();
                // Chat.message('ok so correct binary is '+this.executable)
            }
        }).setFps(4);

        this.on('renderOverlay', () => {
            if (!this.data || (this.data && this.data.song !== 'None')) {
                this.renderOverlay();
            }
        });

        register('gameUnload', () => {
            this.savePosition();
            this.killBinary();
        });
        register('guiClosed', () => this.savePosition());
    }
    isProcessAlive() {
        if (!this.musicProcess) return false;
        try {
            this.musicProcess.exitValue();
            return false;
        } catch (e) {
            return true;
        }
    }

    getCorrectBinary() {
        if (isWindows) {
            this.executable = this.executableBase + '.exe';
        } else {
            this.executable = this.executableBase;
        }
    }

    isExecutableInAssets() {
        return new File(this.assetsDir, this.executable).exists();
    }

    parseTimeToSeconds(timeStr) {
        if (!timeStr || !timeStr.includes(':')) return 0;
        const parts = timeStr.split(':').map((p) => Number.parseInt(p, 10));
        if (parts.some((p) => Number.isNaN(p))) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] || 0;
    }
    addShutdownHook() {
        java.lang.Runtime.getRuntime().addShutdownHook(
            new java.lang.Thread(() => {
                if (this.musicProcess) {
                    this.musicProcess.destroyForcibly();
                }
            })
        );
    }
    runBinary() {
        if (!this.isExecutableInAssets()) return false;
        if (this.isProcessAlive()) return false;
        try {
            const bin = new File(this.assetsDir, this.executable);
            const PB = new ProcessBuilder(bin);

            if (!isWindows) {
                bin.setExecutable(true);
            }
            PB.directory(this.assetsDir);
            this.musicProcess = PB.start();
            // Chat.message("meow")
        } catch (e) {
            Chat.message('hi error in music thing runbinary', +e);
        }
    }
    formatSecondsToTime(seconds) {
        const s = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(s / 3600);
        const mins = Math.floor(s / 60);
        const minsInHour = mins % 60;
        const secs = s % 60;
        if (hours > 0) {
            return hours + ':' + (minsInHour < 10 ? '0' + minsInHour : minsInHour) + ':' + (secs < 10 ? '0' + secs : secs);
        }
        return mins + ':' + (secs < 10 ? '0' + secs : secs);
    }

    killBinary() {
        if (this.musicProcess) {
            this.musicProcess.destroyForcibly();
            this.musicProcess = null;
        }
    }

    getPlaybackState() {
        if (!this.data) {
            return {
                currentText: '--:--',
                totalText: '--:--',
                progress: 0,
            };
        }

        const hasMsTimeline = typeof this.data.positionMs === 'number' && typeof this.data.durationMs === 'number' && this.data.durationMs > 0;
        const isPaused = !!this.data.isPaused;

        let currentSec = 0;
        let totalSec = 0;

        if (hasMsTimeline) {
            currentSec = Math.max(0, this.data.positionMs / 1000);
            totalSec = Math.max(0, this.data.durationMs / 1000);

            const baseTimestamp =
                typeof this.data.snapshotUnixMs === 'number' && this.data.snapshotUnixMs > 0 ? this.data.snapshotUnixMs : this.lastDataReceivedAt;

            if (!isPaused && baseTimestamp > 0) {
                const elapsedSinceReceive = Math.max(0, (Date.now() - baseTimestamp) / 1000);
                currentSec += Math.min(elapsedSinceReceive, 5.0);
            }
        } else {
            currentSec = this.parseTimeToSeconds(this.data.time || '0:00');
            totalSec = this.parseTimeToSeconds(this.data.totalTime || '0:00');
        }

        if (totalSec > 0) {
            currentSec = Math.min(currentSec, totalSec);
        }

        return {
            currentText: this.formatSecondsToTime(currentSec),
            totalText: totalSec > 0 ? this.formatSecondsToTime(totalSec) : this.data.totalTime || '0:00',
            progress: totalSec > 0 ? Math.max(0, Math.min(currentSec / totalSec, 1)) : 0,
        };
    }

    savePosition() {
        this.syncFromOverlayEditor();
        this.positionConfig = {
            x: this.x,
            y: this.y,
            scale: this.scale,
        };
        if (OverlayManager && OverlayManager.musicSettings) {
            OverlayManager.musicSettings.x = this.x;
            OverlayManager.musicSettings.y = this.y;
            OverlayManager.musicSettings.scale = this.scale;
        }
        Utils.writeConfigFile('OverlayPositions/music_overlay.json', this.positionConfig);
    }

    syncFromOverlayEditor() {
        const latest = OverlayManager?.musicSettings;
        if (!latest || typeof latest !== 'object') return;

        if (typeof latest.x === 'number') this.x = latest.x;
        if (typeof latest.y === 'number') this.y = latest.y;
        if (typeof latest.scale === 'number') this.scale = Math.max(0.5, Math.min(3.0, latest.scale));

        this.positionConfig = latest;
    }

    renderOverlay() {
        if (OverlayManager.drawingGUI) return;

        this.syncFromOverlayEditor();

        const sw = Renderer.screen.getWidth();
        const sh = Renderer.screen.getHeight();

        const isSkeleton = !this.data;
        const songName = isSkeleton ? 'Searching for Media...' : this.data.song || 'Unknown Title';
        const imageURL = isSkeleton || !this.data.art || this.data.art.toLowerCase() === 'none' ? '' : this.data.art;

        const playback = this.getPlaybackState();
        const interpolatedTimeText = playback.currentText;
        const timeMax = playback.totalText;
        const progress = playback.progress;

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

    onDisable() {
        this.savePosition();
        this.killBinary();
    }

    fetchData() {
        requestV2({
            url: 'http://localhost:61942/',
            method: 'GET',
            timeout: 150,
            json: true,
        })
            .then((res) => {
                this.data = res;
                this.lastDataReceivedAt = Date.now();
            })
            .catch((e) => {
                const now = Date.now();
                if (now - this.lastRestartAttempt < 2000) return;
                this.lastRestartAttempt = now;
                if (!this.isProcessAlive()) {
                    this.runBinary();
                }
            });
    }
}

new Music();
