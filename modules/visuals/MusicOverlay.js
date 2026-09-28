import requestV2 from '../../utils/Request';
import { drawImageFromURL, THEME } from '../../gui/Utils';
import { File, InputStreamReader, isWindows, ProcessBuilder, Runtime, Scanner, globalAssetsDir } from '../../utils/Constants';
import { chat } from '../../utils/Chat';
import { streamDownloadToFile } from '../../utils/FileUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { executeAsync } from '../../utils/ThreadExecutor';
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

        this.data = null;
        this.lastDataReceivedAt = 0;
        this.lastRestartAttempt = 0;

        this.overlaySettings = OverlayManager.musicSettings;
        this.overlay = {};
        this.playback = { currentText: '--:--', totalText: '--:--', progress: 0 };
        this.lastCurrentSecond = null;
        this.lastTotalSecond = null;
        this.lastFallbackTotalText = null;
        this.lastTimeText = null;
        this.lastTotalTimeText = null;
        this.parsedCurrentSeconds = 0;
        this.parsedTotalSeconds = 0;
        this.artworkUrl = '';
        this.drawArtwork = (x, y, size) => drawImageFromURL(this.artworkUrl, x, y, size, size, 6);
        this.drawArgs = {
            overlay: this.overlay,
            songName: '',
            currentTime: '--:--',
            totalTime: '--:--',
            progress: 0,
            titleColor: THEME.TEXT_MUTED,
            drawArtwork: null,
        };

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
        register('gameUnload', () => OverlayManager.saveMusicSettings());
        register('guiClosed', () => OverlayManager.saveMusicSettings());
        Runtime.getRuntime().addShutdownHook(new java.lang.Thread(() => this.stopWindowsProgram()));
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

    getPlaybackState(data) {
        if (!data) {
            this.lastCurrentSecond = null;
            this.lastTotalSecond = null;
            this.lastFallbackTotalText = null;
            this.playback.currentText = '--:--';
            this.playback.totalText = '--:--';
            this.playback.progress = 0;
            return this.playback;
        }

        const hasMsTimeline = typeof data.positionMs === 'number' && typeof data.durationMs === 'number' && data.durationMs > 0;
        const isPaused = !!data.isPaused;

        let currentSec = 0;
        let totalSec = 0;

        if (hasMsTimeline) {
            currentSec = Math.max(0, data.positionMs / 1000);
            totalSec = Math.max(0, data.durationMs / 1000);

            const baseTimestamp = typeof data.snapshotUnixMs === 'number' && data.snapshotUnixMs > 0 ? data.snapshotUnixMs : this.lastDataReceivedAt;

            if (!isPaused && baseTimestamp > 0) {
                const elapsedSinceReceive = Math.max(0, (Date.now() - baseTimestamp) / 1000);
                currentSec += Math.min(elapsedSinceReceive, 5.0);
            }
        } else {
            const timeText = data.time || '0:00';
            const totalTimeText = data.totalTime || '0:00';
            if (timeText !== this.lastTimeText) {
                this.lastTimeText = timeText;
                this.parsedCurrentSeconds = this.parseTimeToSeconds(timeText);
            }
            if (totalTimeText !== this.lastTotalTimeText) {
                this.lastTotalTimeText = totalTimeText;
                this.parsedTotalSeconds = this.parseTimeToSeconds(totalTimeText);
            }
            currentSec = this.parsedCurrentSeconds;
            totalSec = this.parsedTotalSeconds;
        }

        if (totalSec > 0) {
            currentSec = Math.min(currentSec, totalSec);
        }

        const currentSecond = Math.floor(currentSec);
        if (currentSecond !== this.lastCurrentSecond) {
            this.lastCurrentSecond = currentSecond;
            this.playback.currentText = this.formatSecondsToTime(currentSecond);
        }
        if (totalSec > 0) {
            const totalSecond = Math.floor(totalSec);
            if (totalSecond !== this.lastTotalSecond) {
                this.lastTotalSecond = totalSecond;
                this.playback.totalText = this.formatSecondsToTime(totalSecond);
            }
            this.lastFallbackTotalText = null;
        } else {
            const totalText = data.totalTime || '0:00';
            if (totalText !== this.lastFallbackTotalText) {
                this.lastFallbackTotalText = totalText;
                this.playback.totalText = totalText;
            }
            this.lastTotalSecond = null;
        }
        this.playback.progress = totalSec > 0 ? Math.max(0, Math.min(currentSec / totalSec, 1)) : 0;
        return this.playback;
    }

    renderOverlay() {
        if (OverlayManager.drawingGUI) return;

        const settings = this.overlaySettings;
        if (!settings.enabled) return;

        const sw = Render2D.screen.getWidth();
        const data = this.data;
        const isSkeleton = !data;
        const songName = isSkeleton ? 'Searching for Media...' : data.song || 'Unknown Title';
        const imageURL = isSkeleton || !data.art || data.art.toLowerCase() === 'none' ? '' : data.art;

        const playback = this.getPlaybackState(data);

        const scale = settings.scale || 1.0;
        const bounds = getMusicOverlayBounds(scale, songName);
        const overlay = this.overlay;
        overlay.x = clamp(settings.x, 0, Math.max(0, sw - bounds.width));
        overlay.y = settings.y;
        overlay.scale = settings.scale;
        overlay.enabled = settings.enabled;
        overlay.width = bounds.width;
        overlay.height = bounds.height;
        this.artworkUrl = imageURL;
        const drawArgs = this.drawArgs;
        drawArgs.songName = songName;
        drawArgs.currentTime = playback.currentText;
        drawArgs.totalTime = playback.totalText;
        drawArgs.progress = playback.progress;
        drawArgs.titleColor = isSkeleton ? THEME.TEXT_MUTED : THEME.TEXT;
        drawArgs.drawArtwork = imageURL.length > 5 ? this.drawArtwork : null;

        try {
            drawMusicOverlay(drawArgs);
        } catch (e) {}
    }

    onDisable() {
        Render2D.unloadImage(this.data?.art || '');
        OverlayManager.saveMusicSettings();
        this.stopWindowsProgram();
    }

    fetchWindowsData() {
        requestV2({
            url: 'http://127.0.0.1:61942/',
            method: 'GET',
            timeout: 750,
            json: true,
        })
            .then((res) => {
                if (this.data?.art !== res.art) Render2D.unloadImage(this.data?.art || '');
                this.data = res;
                this.lastDataReceivedAt = Date.now();
            })
            .catch((e) => {
                // would only really happen if it wasn't running.
                Render2D.unloadImage(this.data?.art || '');
                this.data = null;
                if (this.checkWindowsProgram()) return;
                const now = Date.now();
                if (now - this.lastRestartAttempt < 2000) return;
                this.lastRestartAttempt = now;
                this.runWindowsProgram();
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

        executeAsync(() => {
            try {
                chat('&7WindowsMusicHelper.exe not found. Downloading...');
                let lastUpdate = -25;
                streamDownloadToFile(this.windowsExeDownloadUrl, this.exePath, (percent) => {
                    if (percent >= lastUpdate + 25) {
                        chat(`&7Music helper download: &b${percent}%`);
                        lastUpdate = percent;
                    }
                });
                chat('&aWindows music helper installed.');
            } catch (e) {
                chat(`&cWindows music helper download failed: ${e}`);
                console.error(`[Music] Download error: ${e}`);
                try {
                    if (this.exePath.exists() && this.exePath.length() <= 0) this.exePath.delete();
                } catch (e) {}
            } finally {
                this.isDownloadingHelper = false;
            }
        });
    }

    runWindowsProgram() {
        if (!this.exePath.exists()) {
            this.downloadWindowsProgram();
            return;
        }
        if (this.checkWindowsProgram()) return;

        try {
            const pb = new ProcessBuilder(this.exePath.getAbsolutePath());
            pb.directory(this.assetsDir);
            this.musicProcess = pb.start();
        } catch (e) {
            console.error(`[Music] Start error: ${e}`);
            return;
        }

        new Thread(() => {
            let sc = null;
            try {
                sc = new Scanner(new InputStreamReader(this.musicProcess.getInputStream()));
                while (this.musicProcess !== null && this.musicProcess.isAlive()) {
                    if (sc.hasNextLine()) sc.nextLine();
                    else Thread.sleep(100);
                }
            } catch (e) {
            } finally {
                if (sc) sc.close();
                if (this.musicProcess !== null && !this.musicProcess.isAlive()) this.musicProcess = null;
            }
        }).start();
    }

    stopWindowsProgram() {
        if (this.musicProcess !== null) {
            this.musicProcess.destroyForcibly();
            this.musicProcess = null;
        }
        try {
            Runtime.getRuntime().exec(`taskkill /F /IM ${this.windowsExePath}`);
        } catch (e) {}
    }
}

new Music();
