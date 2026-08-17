import requestV2 from 'requestV2';
import { BORDER_WIDTH, CORNER_RADIUS, drawImageFromURL, drawRoundedRectangleWithBorder, drawText, FontSizes, getTextWidth, THEME } from '../../gui/Utils';
import { File, isWindows, ProcessBuilder, globalAssetsDir } from '../../utils/Constants';
import { chat } from '../../utils/Chat';
import { streamDownloadToFile } from '../../utils/FileUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { Executor, getExecutorGeneration, isExecutorGenerationCurrent, scheduleClient } from '../../utils/ThreadExecutor';
import { Utils } from '../../utils/Utils';
import { OverlayManager } from '../../gui/OverlayUtils';
import { clamp, drawMusicOverlay, getMusicOverlayBounds } from '../../gui/OverlayRenderers';

class Music extends ModuleBase {
    constructor() {
        super({ name: 'Music Overlay', subcategory: 'Visuals' });

        this.musicProcess = null;
        this.assetsDir = globalAssetsDir.getAbsoluteFile();
        this.windowsExeDownloadUrl = 'https://github.com/V5-Client/WindowsMusicHelper/releases/download/v1.0.0/WindowsMusicHelper.exe';
        this.windowsExePath = 'WindowsMusicHelper.exe';
        this.exePath = this.resolveExePath();
        this.isDownloadingHelper = false;
        this.isStartingHelper = false;

        this.data = null;
        this.lastDataReceivedAt = 0;
        this.lastRestartAttempt = 0;

        this.positionConfig = Utils.getConfigFile('OverlayPositions/music_overlay.json') || {};
        const savedX = typeof this.positionConfig.x === 'number' ? this.positionConfig.x : 100;
        const savedY = typeof this.positionConfig.y === 'number' ? this.positionConfig.y : 100;
        const savedScale = typeof this.positionConfig.scale === 'number' ? this.positionConfig.scale : 1.0;

        this.x = savedX;
        this.y = savedY;
        this.scale = clamp(savedScale, 0.5, 3.0);
        this.dynamicWidth = 200;
        this.baseHeight = 90;

        this.on('step', () => {
            if (Client.getFPS() > 0) {
                this.getSongData();
            }
        }).setFps(4);

        this.on('renderOverlay', () => {
            if (this.data?.song !== 'None') {
                this.renderOverlay();
            }
        });

        register('worldUnload', () => this.stopWindowsProgram());
        register('gameUnload', () => {
            this.savePosition();
            this.stopWindowsProgram();
        });
        register('guiClosed', () => this.savePosition());
    }

    parseTimeToSeconds(timeStr) {
        if (!timeStr || !timeStr.includes(':')) return 0;
        const parts = timeStr.split(':').map((p) => Number.parseInt(p, 10));
        if (parts.some((p) => Number.isNaN(p))) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] || 0;
    }

    resolveExePath() {
        return new File(this.assetsDir, this.windowsExePath).getAbsoluteFile();
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
        if (typeof latest.scale === 'number') this.scale = clamp(latest.scale, 0.5, 3.0);

        this.positionConfig = latest;
    }

    renderOverlay() {
        if (OverlayManager.drawingGUI) return;

        this.syncFromOverlayEditor();

        const sw = Render2D.screen.getWidth();
        const sh = Render2D.screen.getHeight();

        const isSkeleton = !this.data;
        const songName = isSkeleton ? 'Searching for Media...' : this.data.song || 'Unknown Title';
        const imageURL = isSkeleton || !this.data.art || this.data.art.toLowerCase() === 'none' ? '' : this.data.art;

        const playback = this.getPlaybackState();
        const interpolatedTimeText = playback.currentText;
        const timeMax = playback.totalText;
        const progress = playback.progress;

        const overlay = {
            x: this.x,
            y: this.y,
            scale: this.scale || 1.0,
            ...getMusicOverlayBounds(this.scale || 1.0, songName),
        };
        this.dynamicWidth = overlay.width;
        this.baseHeight = overlay.height;
        overlay.x = clamp(overlay.x, 0, Math.max(0, sw - overlay.width));
        this.x = overlay.x;

        try {
            drawMusicOverlay({
                overlay,
                songName,
                currentTime: interpolatedTimeText,
                totalTime: timeMax,
                progress,
                titleColor: isSkeleton ? THEME.TEXT_MUTED : THEME.TEXT,
                drawArtwork: imageURL.length > 5 ? (x, y, size) => drawImageFromURL(imageURL, x, y, size, size, 6) : null,
            });
        } catch (e) {}
    }

    onDisable() {
        this.savePosition();
        this.stopWindowsProgram();
    }

    fetchWindowsData() {
        const generation = getExecutorGeneration();
        requestV2({
            url: 'http://127.0.0.1:61942/',
            method: 'GET',
            connectTimeout: 750,
            readTimeout: 750,
            json: true,
        })
            .then((res) => {
                scheduleClient(
                    () => {
                        this.data = res;
                        this.lastDataReceivedAt = Date.now();
                    },
                    0,
                    generation
                );
            })
            .catch((e) => {
                scheduleClient(
                    () => {
                        // would only really happen if it wasn't running.
                        this.data = null;
                        if (this.checkWindowsProgram()) return;
                        const now = Date.now();
                        if (now - this.lastRestartAttempt < 2000) return;
                        this.lastRestartAttempt = now;
                        this.runWindowsProgram();
                    },
                    0,
                    generation
                );
            });
    }

    getSongData() {
        if (isWindows) {
            this.assetsDir = globalAssetsDir.getAbsoluteFile();
            this.exePath = this.resolveExePath();
            if (!this.exePath.exists()) {
                this.downloadWindowsProgram();
                return;
            }
            if (!this.checkWindowsProgram()) this.runWindowsProgram();
            this.fetchWindowsData();
        }
    }

    checkWindowsProgram() {
        return this.musicProcess !== null && this.musicProcess.isAlive();
    }

    downloadWindowsProgram() {
        if (!isWindows || this.isDownloadingHelper) return;
        this.isDownloadingHelper = true;

        const submitted = Executor.execute((generation) => {
            try {
                scheduleClient(() => chat('&7WindowsMusicHelper.exe not found. Downloading...'), 0, generation);
                let lastUpdate = -25;
                streamDownloadToFile(this.windowsExeDownloadUrl, this.exePath, (percent) => {
                    if (percent >= lastUpdate + 25) {
                        scheduleClient(() => chat(`&7Music helper download: &b${percent}%`), 0, generation);
                        lastUpdate = percent;
                    }
                });
                scheduleClient(() => chat('&aWindows music helper installed.'), 0, generation);
            } catch (e) {
                scheduleClient(() => chat(`&cWindows music helper download failed: ${e}`), 0, generation);
                console.error(`[Music] Download error: ${e}`);
                try {
                    if (this.exePath.exists() && this.exePath.length() <= 0) this.exePath.delete();
                } catch (deleteError) {}
            } finally {
                scheduleClient(() => (this.isDownloadingHelper = false), 0, generation);
            }
        });
        if (!submitted) this.isDownloadingHelper = false;
    }

    runWindowsProgram() {
        if (!this.exePath.exists()) {
            this.downloadWindowsProgram();
            return;
        }
        if (this.checkWindowsProgram() || this.isStartingHelper) return;
        this.isStartingHelper = true;

        const submitted = Executor.execute((generation) => {
            try {
                const pb = new ProcessBuilder(this.exePath.getAbsolutePath());
                pb.directory(this.assetsDir);
                pb.redirectErrorStream(true);
                pb.redirectOutput(java.lang.ProcessBuilder.Redirect.DISCARD);
                const process = pb.start();
                if (!isExecutorGenerationCurrent(generation)) return process.destroyForcibly();
                scheduleClient(
                    () => {
                        this.musicProcess = process;
                        this.isStartingHelper = false;
                    },
                    0,
                    generation
                );
            } catch (e) {
                scheduleClient(() => (this.isStartingHelper = false), 0, generation);
                console.error(`[Music] Start error: ${e}`);
            }
        });
        if (!submitted) this.isStartingHelper = false;
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
