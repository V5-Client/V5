import { Chat } from './Chat';
import { File, ProcessBuilder, isLinux, isMac, isWindows, FFMPEG_URLS, globalAssetsDir } from './Constants';
import { deleteRecursive, ensureDirectory, findFileRecursive, streamDownloadToFile } from './FileUtils';
import { ModuleBase } from './ModuleBase';
import { Executor } from './ThreadExecutor';
import { v5Command } from './V5Commands';

const ffmpegName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegFile = new File(globalAssetsDir, ffmpegName);

const clipsDir = new File('./config/ChatTriggers/modules/V5Config/Clips');
const bufferDir = new File(clipsDir, 'buffer');

ensureDirectory(clipsDir);
ensureDirectory(bufferDir);

class ClippingManager extends ModuleBase {
    constructor() {
        super({
            name: 'Clipping',
            subcategory: 'Core',
            description: 'Background recording and clipping utility. Supposed to be used by failsafes.',
            tooltip: 'Records rolling buffer. Use /v5 clip to save.',
            showEnabledToggle: true,
            hideInModules: true,
        });

        this.process = null;
        this.isDownloading = false;
        this.isRecording = false;
        this.fps = 15;
        this.segmentCount = 6;
        this.compressClips = false;

        this.lastW = 0;
        this.lastH = 0;
        this.pixelArray = null;
        this.pixelBuffer = null;
        this.lastFrameTime = 0;
        this.pendingRestartAt = 0;
        this.pendingFpsRestart = false;
        this.isStoppingProcess = false;
        this.isUnloading = false;

        this.addDirectToggle(
            'Enabled',
            (v) => {
                this.toggle(!!v);
            },
            'Enables or disables the clipping system.',
            true,
            'Clipping'
        );

        this.addDirectSlider(
            'FPS',
            15,
            30,
            20,
            (v) => {
                const newFps = Math.floor(v);
                if (this.fps !== newFps) {
                    this.fps = newFps;
                    if (this.isRecording) {
                        this.pendingRestartAt = Date.now() + 300;
                        this.pendingFpsRestart = true;
                    }
                }
            },
            'Recording Framerate. Higher values use more CPU.',
            'Clipping'
        );

        this.addDirectSlider(
            'Segment Count',
            6,
            30,
            12,
            (v) => {
                this.segmentCount = Math.floor(v);
                this.cleanupBuffer();
            },
            'Number of segments to include in clips. Each segment is 5 seconds.',
            'Clipping'
        );

        this.addDirectToggle(
            'Compress Clips',
            (v) => {
                this.compressClips = v;
            },
            'Automatically compresses clips to reduce file size.',
            false,
            'Clipping'
        );

        v5Command('clip', (...args) => {
            if (args && args[0] && args[0].toLowerCase() === 'compress') {
                this.compressLatestClip();
            } else {
                this.saveClip();
            }
        });

        register('gameUnload', () => {
            this.isUnloading = true;
            this.pendingRestartAt = 0;
            this.stopRecording(false, true, true);
        });

        register('step', () => {
            if (!this.enabled || !bufferDir.exists()) return;
            this.cleanupBuffer();
        }).setDelay(5);

        register('step', () => {
            if (!this.enabled || !this.isRecording || !this.pendingRestartAt) return;
            if (Date.now() < this.pendingRestartAt) return;

            const isFpsRestart = this.pendingFpsRestart;
            this.pendingRestartAt = 0;
            this.pendingFpsRestart = false;
            if (isFpsRestart) Chat.messageClip('&7FPS changed. Restarting recorder and clearing buffer...');
            this.stopRecording(!!isFpsRestart, true, true);
            this.startRecording(true);
        }).setDelay(1);

        register('step', () => {
            if (!this.isRecording || !this.process) return;

            const window = Client.getMinecraft().getWindow();
            const w = window.getFramebufferWidth();
            const h = window.getFramebufferHeight();

            if (this.lastW && (this.lastW !== w || this.lastH !== h)) {
                this.stopRecording(false, true, true);
                this.startRecording(true);
                return;
            }
            this.lastW = w;
            this.lastH = h;

            const now = Date.now();
            const frameTimeMs = 1000 / this.fps;
            if (now - this.lastFrameTime < frameTimeMs - 2) return;

            if (now - this.lastFrameTime > frameTimeMs * 2) {
                this.lastFrameTime = now;
            } else {
                this.lastFrameTime += frameTimeMs;
            }

            try {
                const size = w * h * 4;

                if (!this.pixelBuffer || this.pixelBuffer.capacity() !== size) {
                    this.pixelBuffer = java.nio.ByteBuffer.allocateDirect(size);
                    this.pixelArray = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, size);
                }

                this.pixelBuffer.clear();

                org.lwjgl.opengl.GL11.glReadPixels(0, 0, w, h, org.lwjgl.opengl.GL11.GL_RGBA, org.lwjgl.opengl.GL11.GL_UNSIGNED_BYTE, this.pixelBuffer);

                const currentBuffer = this.pixelBuffer.duplicate();
                const currentArray = this.pixelArray;
                const process = this.process;

                Executor.execute(() => {
                    try {
                        if (process) {
                            currentBuffer.rewind();
                            currentBuffer.get(currentArray);

                            const os = process.getOutputStream();
                            os.write(currentArray);
                            os.flush();
                        }
                    } catch (e) {
                        this.isRecording = false;
                    }
                });
            } catch (e) {
                console.error('Clipping capture failed: ' + e);
            }
        });
    }

    compressClip(inputClip) {
        Executor.execute(() => {
            try {
                if (!inputClip.exists()) return Chat.messageClip('&cClip file not found!');

                const outputName = inputClip.getName().replaceAll('.mp4', '_compressed.mp4');
                const outputFile = new File(clipsDir, outputName);

                Chat.messageClip(`&eCompressing &f${inputClip.getName()}&e...`);

                // prettier-ignore
                const args = [
                    ffmpegFile.getAbsolutePath(),
                    '-y',
                    '-i', inputClip.getAbsolutePath(),
                    '-c:v', 'libx265',
                    '-crf', '28',
                    '-preset', 'ultrafast',
                    '-vf', 'scale=-2:1080',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    outputFile.getAbsolutePath(),
                ]; // updated to have audio (no clue if work)

                const pb = new ProcessBuilder(...args);
                pb.redirectErrorStream(true);
                const p = pb.start();

                const reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
                let line;
                const logTail = [];

                while ((line = reader.readLine()) != null) {
                    if (logTail.length >= 20) logTail.shift();
                    logTail.push(line);
                }

                reader.close();

                const exitCode = p.waitFor();

                if (exitCode !== 0) {
                    Chat.messageClip(`&cCompression failed with code ${exitCode}.`);
                    logTail.slice(-3).forEach((l) => Chat.messageClip('&c' + l));
                    try {
                        outputFile.delete();
                    } catch (e) {
                        console.error('V5 Caught error' + e + e.stack);
                    }
                } else {
                    Chat.messageClip(`&aSuccessfully compressed: &b${outputFile.getName()}`);
                }
            } catch (e) {
                Chat.messageClip(`&cCompression failed: ${e}`);
                console.error('V5 Caught error' + e + e.stack);
            }
        });
    }

    compressLatestClip() {
        Chat.messageClip('&7Finding latest clip to compress');

        Executor.execute(() => {
            try {
                if (!clipsDir.exists()) return;

                const files = clipsDir.listFiles();

                if (!files || files.length === 0) return Chat.messageClip('&cNo clips found.');

                const clips = Array.from(files).filter(
                    (f) => f.getName().startsWith('Clip_') && f.getName().endsWith('.mp4') && !f.getName().includes('_compressed')
                );

                if (clips.length === 0) return Chat.messageClip('&cNo eligible clips found.');

                clips.sort((a, b) => b.lastModified() - a.lastModified());
                const inputClip = clips[0];

                this.compressClip(inputClip);
            } catch (e) {
                Chat.messageClip(`&cCompression failed: ${e}`);
                console.error('V5 Caught error' + e + e.stack);
            }
        });
    }

    downloadFFmpeg() {
        if (this.isDownloading) return;
        this.isDownloading = true;

        Executor.execute(() => {
            try {
                let urlStr;
                let archiveName;
                if (isWindows) {
                    urlStr = FFMPEG_URLS.WIN_ZIP;
                    archiveName = 'ffmpeg.zip';
                } else if (isLinux) {
                    urlStr = FFMPEG_URLS.LINUX_TAR_XZ;
                    archiveName = 'ffmpeg.tar.xz';
                } else {
                    urlStr = FFMPEG_URLS.MAC_BINARY;
                    archiveName = ffmpegName;
                }
                const archiveFile = new File(globalAssetsDir, archiveName);

                Chat.messageClip(`&7Starting download: &f${archiveName}`);

                let lastUpdate = -25;
                streamDownloadToFile(urlStr, archiveFile, (percent) => {
                    if (percent >= lastUpdate + 25) {
                        Chat.messageClip(`&7Downloading: &b${percent}%`);
                        lastUpdate = percent;
                    }
                });

                if (isMac) {
                    this.organizeBinaries();
                    Chat.messageClip('&aDownload complete!');
                    this.startRecording(true);
                    return;
                }

                Chat.messageClip('&aDownload complete! Extracting...');
                this.extractFFmpeg(archiveFile);
            } catch (e) {
                Chat.messageClip(`&cDownload failed: ${e}`);
                console.error('V5 Caught error' + e + e.stack);
            } finally {
                this.isDownloading = false;
            }
        });
    }
    extractFFmpeg(archiveFile) {
        try {
            let cmd = [];
            const archivePath = archiveFile.getAbsolutePath();
            const destPath = globalAssetsDir.getAbsolutePath();

            if (isWindows) {
                cmd = [
                    'powershell',
                    '-Command',
                    `& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('${archivePath}', '${destPath}'); }`,
                ];
            } else if (isLinux) {
                cmd = ['tar', '-xf', archivePath, '-C', destPath];
            } else if (isMac) {
                cmd = ['tar', '-xf', archivePath, '-C', destPath];
            }

            const pb = new ProcessBuilder(...cmd);
            pb.directory(globalAssetsDir);
            pb.redirectErrorStream(true);
            const p = pb.start();

            const reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
            let line;
            const logTail = [];

            while ((line = reader.readLine()) != null) {
                if (logTail.length >= 20) logTail.shift();
                logTail.push(line);
            }

            reader.close();

            const exitCode = p.waitFor();

            if (exitCode !== 0) {
                Chat.messageClip(`&cExtraction failed with code ${exitCode}.`);
                logTail.slice(-3).forEach((l) => Chat.messageClip('&c' + l));
                return;
            }

            this.organizeBinaries();
            archiveFile.delete();

            Chat.messageClip('&aFFmpeg installed!');
            this.startRecording();
        } catch (e) {
            Chat.messageClip(`&cExtraction failed: ${e}`);
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    organizeBinaries() {
        const foundBin = findFileRecursive(globalAssetsDir, ffmpegName);
        if (foundBin && !foundBin.getParentFile().equals(globalAssetsDir)) {
            const dest = new File(globalAssetsDir, ffmpegName);
            if (dest.exists()) dest.delete();
            foundBin.renameTo(dest);
        }

        const cleanupDirs = ['ffmpeg-master-latest-win64-gpl', 'ffmpeg-master-latest-linux64-gpl'];

        cleanupDirs.forEach((name) => {
            const f = new File(globalAssetsDir, name);
            if (f.exists()) deleteRecursive(f);
        });

        if (!isWindows) {
            const pb = new ProcessBuilder('chmod', '+x', ffmpegFile.getAbsolutePath());
            pb.start().waitFor();
        }
    }

    getWindowTitle() {
        let mcClass = Client.getMinecraft().getClass();
        let method = mcClass.getDeclaredMethod('method_24287'); // getWindowTitle()
        method.setAccessible(true);

        return method.invoke(Client.getMinecraft());
    }

    cleanupBuffer() {
        Executor.execute(() => {
            try {
                const files = bufferDir.listFiles();
                if (!files) return;

                const segments = Array.from(files)
                    .filter((f) => f.getName().endsWith('.mp4'))
                    .sort((a, b) => a.lastModified() - b.lastModified());

                const maxSegments = Math.max(1, this.segmentCount + 1);
                const overflow = segments.length - maxSegments;

                for (let i = 0; i < overflow; i++) {
                    try {
                        segments[i].delete();
                    } catch (e) {}
                }
            } catch (e) {}
        });
    }

    startRecording(silent) {
        if (silent === undefined) silent = false;

        if (!ffmpegFile.exists()) {
            Chat.messageClip('FFmpeg not found. Downloading...');
            this.downloadFFmpeg();
            return;
        }

        if (this.isRecording || !this.enabled || this.isUnloading) return;
        if (this.process && this.process.isAlive()) return;

        const window = Client.getMinecraft().getWindow();
        const width = window.getFramebufferWidth();
        const height = window.getFramebufferHeight();
        this.lastFrameTime = 0;

        const sessionId = Date.now();
        const outputPath = new File(bufferDir, `segment_${sessionId}_%03d.mp4`).getAbsolutePath();
        const gopSize = Math.floor(this.fps * 5);

        let args = [
            ffmpegFile.getAbsolutePath(),
            '-y',
            '-f',
            'rawvideo',
            '-vcodec',
            'rawvideo',
            '-s',
            `${width}x${height}`,
            '-pix_fmt',
            'rgba',
            '-framerate',
            String(this.fps),
            '-use_wallclock_as_timestamps',
            '1',
            '-i',
            '-',
            '-c:v',
            'libx264',
            '-r',
            String(this.fps),
            '-vf',
            'vflip,scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-pix_fmt',
            'yuv420p',
            '-preset',
            'ultrafast',
            '-crf',
            '25',
            '-g',
            String(gopSize),
            '-sc_threshold',
            '0',
            '-force_key_frames',
            `expr:gte(t,n_forced*5)`,
            '-f',
            'segment',
            '-segment_time',
            '5',
            '-reset_timestamps',
            '1',
            outputPath,
        ];

        Executor.execute(() => {
            try {
                const pb = new ProcessBuilder(...args);
                pb.redirectErrorStream(true);

                const currentProcess = pb.start();
                this.process = currentProcess;
                this.isRecording = true;
                if (!silent) Chat.messageClip('&7Background recording started.');

                const reader = new java.io.BufferedReader(new java.io.InputStreamReader(currentProcess.getInputStream()));
                let line;
                while ((line = reader.readLine()) != null) {
                    if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
                        console.warn('[FFmpeg Error] ' + line);
                    }
                }

                currentProcess.waitFor();

                if (this.isRecording) {
                    Chat.messageClip('&cRecording stopped unexpectedly.');
                    this.isRecording = false;
                }

                this.process = null;
            } catch (e) {
                const interrupted = String(e).toLowerCase().includes('interruptedexception');
                if (!this.isRecording || this.isStoppingProcess || this.isUnloading || interrupted) return;
                Chat.messageClip(`&cCritical Error: ${e}`);
                this.isRecording = false;
                this.process = null;
            }
        });
    }

    stopRecording(clear, silent, waitForExit) {
        if (clear === undefined) clear = true;
        if (silent === undefined) silent = false;
        if (waitForExit === undefined) waitForExit = true;
        if (this.isStoppingProcess) return;

        const process = this.process;
        this.isStoppingProcess = true;
        this.pendingRestartAt = 0;
        this.pendingFpsRestart = false;
        this.isRecording = false;

        if (process) {
            try {
                process.getOutputStream().close();
            } catch (e) {}

            if (waitForExit) {
                let waitCount = 0;
                while (process.isAlive() && waitCount < 25) {
                    try {
                        Thread.sleep(100);
                    } catch (e) {
                        break;
                    }
                    waitCount++;
                }
            }

            if (process.isAlive()) {
                process.destroy();
                if (waitForExit) {
                    let waitCount = 0;
                    while (process.isAlive() && waitCount < 10) {
                        try {
                            Thread.sleep(50);
                        } catch (e) {
                            break;
                        }
                        waitCount++;
                    }
                }
            }
            if (!silent) Chat.messageClip('&7Recorder stopped.');
        }

        this.process = null;
        this.lastFrameTime = 0;
        this.isStoppingProcess = false;
        if (clear) this.clearBuffer();
    }

    clearBuffer() {
        if (!bufferDir.exists()) return;
        const files = bufferDir.listFiles();
        if (!files) return;

        for (const file of files) {
            try {
                file.delete();
            } catch (e) {}
        }
    }

    saveClip() {
        Chat.messageClip('&7Saving clip...');

        Executor.execute(() => {
            let writer = null;
            let reader = null;
            let listFile = null;
            let processingDir = null;
            let wasRecording = false;

            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                processingDir = new File(clipsDir, `processing_${timestamp}`);
                ensureDirectory(processingDir);

                wasRecording = this.isRecording;
                this.stopRecording(false, true);

                const files = bufferDir.listFiles();
                if (!files || files.length === 0) {
                    Chat.messageClip('&cNo buffer segments found! Is the recorder running?');
                    this.startRecording(false);
                    return;
                }

                const segments = Array.from(files).filter((f) => f.getName().endsWith('.mp4') && f.length() > 1024);
                segments.sort((a, b) => a.lastModified() - b.lastModified());

                if (segments.length === 0) {
                    this.startRecording(true);
                    return Chat.messageClip('&cNo valid .mp4 segments found in buffer.');
                }

                const clipsToJoin = segments.slice(Math.max(0, segments.length - (this.segmentCount + 1)));

                const copiedClips = [];
                for (const file of clipsToJoin) {
                    const dest = new File(processingDir, file.getName());
                    java.nio.file.Files.copy(file.toPath(), dest.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    copiedClips.push(dest);
                }

                if (wasRecording) this.startRecording(true);

                listFile = new File(processingDir, 'mylist.txt');
                writer = new java.io.FileWriter(listFile);
                for (let f of copiedClips) {
                    const path = f.getAbsolutePath().replace(/\\/g, '/');
                    writer.write(`file '${path}'\n`);
                }
                writer.close();
                writer = null;

                const tempOutFile = new File(processingDir, `temp_concat.mp4`);
                const finalOutFile = new File(clipsDir, `Clip_${timestamp}.mp4`);

                const concatArgs = [
                    ffmpegFile.getAbsolutePath(),
                    '-y',
                    '-fflags',
                    '+genpts',
                    '-f',
                    'concat',
                    '-safe',
                    '0',
                    '-i',
                    listFile.getAbsolutePath(),
                    '-c',
                    'copy',
                    tempOutFile.getAbsolutePath(),
                ];

                let pb = new ProcessBuilder(...concatArgs);
                pb.redirectErrorStream(true);
                let p = pb.start();

                reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
                while (reader.readLine() != null) {}
                reader.close();
                reader = null;

                let exitCode = p.waitFor();

                if (exitCode !== 0 || !tempOutFile.exists()) {
                    Chat.messageClip(`&cFailed to save clip (ffmpeg exit code: ${exitCode}).`);
                    return;
                }

                let finalDuration = clipsToJoin.length * 5;
                const expectedDuration = this.segmentCount * 5;

                if (clipsToJoin.length > this.segmentCount) {
                    const trimArgs = [
                        ffmpegFile.getAbsolutePath(),
                        '-y',
                        '-sseof',
                        `-${expectedDuration}`,
                        '-i',
                        tempOutFile.getAbsolutePath(),
                        '-c',
                        'copy',
                        '-avoid_negative_ts',
                        'make_zero',
                        finalOutFile.getAbsolutePath(),
                    ];

                    pb = new ProcessBuilder(...trimArgs);
                    pb.redirectErrorStream(true);
                    p = pb.start();

                    reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
                    while (reader.readLine() != null) {}
                    reader.close();
                    reader = null;

                    exitCode = p.waitFor();

                    if (exitCode !== 0 || !finalOutFile.exists() || finalOutFile.length() === 0) {
                        if (tempOutFile.exists()) tempOutFile.renameTo(finalOutFile);
                    } else {
                        finalDuration = expectedDuration;
                    }
                } else {
                    if (tempOutFile.exists()) tempOutFile.renameTo(finalOutFile);
                }

                let folderPath = clipsDir.getAbsolutePath();
                Chat.messageClip(Chat.clickAction(`&7Saved ${finalDuration}s &7clip:`, 'View clip', folderPath, `&7Click to open folder`));

                if (this.compressClips) {
                    Thread.sleep(500);
                    this.compressClip(finalOutFile);
                }
            } catch (e) {
                Chat.messageClip(`&cFailed to save clip: &f${e}`);
                console.error(e);
            } finally {
                try {
                    if (reader) reader.close();
                } catch (e) {}
                try {
                    if (writer) writer.close();
                } catch (e) {}
                try {
                    if (processingDir && processingDir.exists()) deleteRecursive(processingDir);
                } catch (e) {}
                try {
                    if (this.enabled && !this.isUnloading && wasRecording && !this.isRecording) this.startRecording(true);
                } catch (e) {}
            }
        });
    }

    onEnable() {
        this.isUnloading = false;
        this.clearBuffer();
        this.startRecording();
    }

    onDisable() {
        this.pendingRestartAt = 0;
        this.pendingFpsRestart = false;
        this.stopRecording(true);
    }
}

const Clipping = new ClippingManager();
export default Clipping;
