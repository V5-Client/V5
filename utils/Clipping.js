import { ModuleBase } from './ModuleBase';
import { Chat } from './Chat';
import { Utils } from './Utils';
import { File, ProcessBuilder, isWindows, isMac, isLinux } from './Constants';
import { Executor } from './ThreadExecutor';
import { v5Command } from './V5Commands';
import { attachMixin } from './AttachMixin';
import { WindowInjection } from '../Mixins/BorderlessFullscreenMixins';

const globalAssetsDir = new File('./config/ChatTriggers/assets');
if (!globalAssetsDir.exists()) globalAssetsDir.mkdirs();

const ffmpegName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegFile = new File(globalAssetsDir, ffmpegName);

const clipsDir = new File('./config/ChatTriggers/modules/V5Config/clips');
const bufferDir = new File(clipsDir, 'buffer');

if (!clipsDir.exists()) clipsDir.mkdirs();
if (!bufferDir.exists()) bufferDir.mkdirs();

const URLS = {
    WIN: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    LINUX: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
    MAC: 'https://evermeet.cx/ffmpeg/ffmpeg-8.0.1.7z', // hardcoded version because the site doesn't have a static latest link
};

// todo
// fix resize issue

class ClippingManager extends ModuleBase {
    constructor() {
        super({
            name: 'Clipping',
            subcategory: 'Core',
            description: 'Background recording and clipping utility. Supposed to be used by failsafes.',
            tooltip: 'Records rolling buffer. Use /clip to save.',
            showEnabledToggle: true,
            hideInModules: true,
        });

        this.process = null;
        this.isDownloading = false;
        this.isRecording = false;
        this.fps = 15;
        this.segmentCount = 6;
        this.compressClips = false;

        this.initMixin();

        this.addDirectSlider(
            'FPS',
            15,
            30,
            20,
            (v) => {
                this.fps = Math.floor(v);
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
                this.initMixin();
                this.saveClip();
            }
        });

        register('gameUnload', () => this.stopRecording());
    }

    initMixin() {
        const GLFW = org.lwjgl.glfw.GLFW;

        attachMixin(WindowInjection, 'WindowInjection', (instance, cir) => {
            if (!Client.getMinecraft().options.fullscreen) return;

            let handle = instance.getHandle();
            if (handle === 0) return;

            GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_DECORATED, GLFW.GLFW_FALSE);

            let monitor = GLFW.glfwGetWindowMonitor(handle);
            if (monitor === 0) monitor = GLFW.glfwGetPrimaryMonitor();

            let videoMode = GLFW.glfwGetVideoMode(monitor);

            if (videoMode != null) {
                let width = videoMode.width();
                let height = videoMode.height();

                GLFW.glfwSetWindowPos(handle, 0, 0);
                GLFW.glfwSetWindowSize(handle, width, height);
            }

            cir.cancel();

            GLFW.glfwSetWindowAttrib(handle, GLFW.GLFW_DECORATED, GLFW.GLFW_TRUE);
        });
    }

    compressClip(inputClip) {
        Executor.execute(() => {
            try {
                if (!inputClip.exists()) return Chat.messageClip('&cClip file not found!');

                const outputName = inputClip.getName().replace('.mp4', '_compressed.mp4');
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
                let logLines = [];

                while ((line = reader.readLine()) != null) logLines.push(line);

                const exitCode = p.waitFor();

                if (exitCode !== 0) {
                    Chat.messageClip(`&cCompression failed with code ${exitCode}.`);
                    logLines.slice(-3).forEach((l) => Chat.messageClip('&c' + l));
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
                let urlStr = isWindows ? URLS.WIN : isLinux ? URLS.LINUX : URLS.MAC;
                let archiveName = isWindows ? 'ffmpeg.zip' : isLinux ? 'ffmpeg.tar.xz' : 'ffmpeg.7z';
                const archiveFile = new File(globalAssetsDir, archiveName);

                Chat.messageClip(`&7Starting download: &f${archiveName}`);

                const url = new java.net.URL(urlStr);
                const connection = url.openConnection();
                connection.connect();

                const fileLength = connection.getContentLength();
                const input = new java.io.BufferedInputStream(url.openStream());
                const output = new java.io.FileOutputStream(archiveFile.getAbsolutePath());

                const data = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
                let total = 0;
                let count;
                let lastUpdate = 0;

                while ((count = input.read(data)) !== -1) {
                    total += count;
                    output.write(data, 0, count);

                    if (fileLength > 0) {
                        let percent = Math.floor((total / fileLength) * 100);

                        if (percent >= lastUpdate + 25) {
                            Chat.messageClip(`&7Downloading: &b${percent}%`);
                            lastUpdate = percent;
                        }
                    }
                }

                output.flush();
                output.close();
                input.close();

                Chat.messageClip('&aDownload complete! Extracting...');
                this.extractFFmpeg(archiveFile);
            } catch (e) {
                Chat.messageClip(`&cDownload failed: ${e}`);
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
            const p = pb.start();
            p.waitFor();

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
        const findFile = (dir, name) => {
            const files = dir.listFiles();
            if (!files) return null;
            for (let f of files) {
                if (f.isDirectory()) {
                    const found = findFile(f, name);
                    if (found) return found;
                } else if (f.getName() === name) {
                    return f;
                }
            }
            return null;
        };

        const foundBin = findFile(globalAssetsDir, ffmpegName);
        if (foundBin && !foundBin.getParentFile().equals(globalAssetsDir)) {
            const dest = new File(globalAssetsDir, ffmpegName);
            if (dest.exists()) dest.delete();
            foundBin.renameTo(dest);
        }

        const cleanupDirs = ['ffmpeg-master-latest-win64-gpl', 'ffmpeg-master-latest-linux64-gpl'];

        cleanupDirs.forEach((name) => {
            const f = new File(globalAssetsDir, name);
            if (f.exists()) this.deleteRecursive(f);
        });

        if (!isWindows) {
            const pb = new ProcessBuilder('chmod', '+x', ffmpegFile.getAbsolutePath());
            pb.start().waitFor();
        }
    }

    deleteRecursive(file) {
        if (file.isDirectory()) file.listFiles().forEach((f) => this.deleteRecursive(f));

        file.delete();
    }

    getWindowTitle() {
        let mcClass = Client.getMinecraft().getClass();
        let method = mcClass.getDeclaredMethod('method_24287'); // getWindowTitle()
        method.setAccessible(true);

        return method.invoke(Client.getMinecraft());
    }

    startRecording() {
        if (!ffmpegFile.exists()) {
            Chat.messageClip('FFmpeg not found. Downloading...');
            this.downloadFFmpeg();
            return;
        }

        if (this.isRecording || !this.enabled) return;

        const windowTitle = this.getWindowTitle();

        try {
            Client.getMinecraft().getWindow().setTitle(windowTitle);
        } catch (e) {
            console.error('Failed to set window title: ' + e);
        }

        this.clearBuffer();

        const outputPath = new File(bufferDir, 'segment_%03d.mp4').getAbsolutePath();
        const gopSize = Math.floor(this.fps * 5);

        let args = [ffmpegFile.getAbsolutePath(), '-y', '-f', isWindows ? 'gdigrab' : isMac ? 'avfoundation' : 'x11grab', '-framerate', String(this.fps)];

        if (isWindows) {
            args.push('-i', `title=${windowTitle}`);
        } else if (isMac) {
            args.push('-i', '1');
        } else {
            args.push('-i', ':0.0');
        }

        // prettier-ignore
        args.push(
            '-c:v', 'libx264',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // apparently x264 needs even dimensions? thats what gemini said :p
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',
            '-crf', '25',
            '-g', String(gopSize),
            '-sc_threshold', '0',
            '-force_key_frames', `expr:gte(t,n_forced*5)`,
            '-f', 'segment',
            '-segment_time', '5',
            '-segment_wrap', '30',
            '-reset_timestamps', '1',
            outputPath
        ); // i genuinely don't know how 99% of these work, i just copied from gemini tbh, but it works

        Executor.execute(() => {
            try {
                const pb = new ProcessBuilder(...args);
                pb.redirectErrorStream(true);

                const currentProcess = pb.start();
                this.process = currentProcess;
                this.isRecording = true;
                Chat.messageClip('&7Background recording started.');

                const reader = new java.io.BufferedReader(new java.io.InputStreamReader(currentProcess.getInputStream()));
                let line;
                while ((line = reader.readLine()) != null) {
                    if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
                        console.warn('[FFmpeg Error] ' + line);
                        if (this.isRecording) {
                            Chat.messageClip(`&cFFmpeg Error: ${line}`);
                        }
                    }
                }

                currentProcess.waitFor();

                if (this.isRecording) {
                    Chat.messageClip('&cRecording stopped unexpectedly.');
                    this.isRecording = false;
                }

                this.process = null;
            } catch (e) {
                Chat.messageClip(`&cCritical Error: ${e}`);
                this.isRecording = false;
                this.process = null;
            }
        });
    }

    stopRecording() {
        if (this.process && this.process.isAlive()) {
            this.process.destroy();
            Chat.messageClip('&7Recorder stopped.');
        }

        this.process = null;
        this.isRecording = false;
        this.clearBuffer();
    }

    clearBuffer() {
        if (!bufferDir.exists()) return;
        const files = bufferDir.listFiles();

        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            try {
                files[i].delete();
            } catch (e) {}
        }
    }

    saveClip() {
        Chat.messageClip('&7Saving clip...');

        Executor.execute(() => {
            try {
                const files = bufferDir.listFiles();

                if (!files || files.length === 0) {
                    Chat.messageClip('&cNo buffer segments found! Is the recorder running?');
                    this.startRecording();
                    return;
                }

                const segments = Array.from(files).filter((f) => f.getName().endsWith('.mp4'));
                segments.sort((a, b) => a.lastModified() - b.lastModified());

                const currentSegment = segments[segments.length - 1];
                let lastModified = currentSegment.lastModified();
                Chat.messageClip('&7Waiting for current segment to finish...');

                while (true) {
                    Thread.sleep(300);
                    const currentModified = currentSegment.lastModified();
                    if (currentModified === lastModified) {
                        Thread.sleep(500);
                        // segment finished
                        break;
                    }
                    lastModified = currentModified;
                }

                // take UP to segmentCount recent segments. so the clips COULD be 5s or 15s or something, max of segmentCount*5s.
                const clipsToJoin = segments.slice(Math.max(0, segments.length - this.segmentCount));

                const listFile = new File(bufferDir, 'mylist.txt');
                const writer = new java.io.FileWriter(listFile);

                for (let f of clipsToJoin) {
                    const path = f.getAbsolutePath().replace(/\\/g, '/');
                    writer.write(`file '${path}'\n`);
                }

                writer.close();

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const outFile = new File(clipsDir, `Clip_${timestamp}.mp4`);

                // prettier-ignore
                const args = [
                    ffmpegFile.getAbsolutePath(),
                    '-y',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', listFile.getAbsolutePath(),
                    '-c', 'copy',
                    outFile.getAbsolutePath(),
                ];

                const pb = new ProcessBuilder(...args);
                pb.redirectErrorStream(true);
                const p = pb.start();

                const reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
                while (reader.readLine() != null) {}

                p.waitFor();

                let clipName = outFile.getName();
                let folderPath = clipsDir.getAbsolutePath();
                let clipDuration = clipsToJoin.length * 5;

                let linkComponent = new TextComponent({
                    text: `&7Saved ${clipDuration}s &7clip: &d&n${clipName}`,
                    clickEvent: {
                        action: 'open_file',
                        value: folderPath,
                    },
                    hoverEvent: {
                        action: 'show_text',
                        value: `&7Click to open folder`,
                    },
                });

                Chat.messageClip('&7Clip Saved: ');
                ChatLib.chat(linkComponent);

                if (this.compressClips) {
                    Thread.sleep(500);
                    this.compressClip(outFile);
                }
            } catch (e) {
                Chat.messageClip(`&cFailed to save clip: &f${e}`);
                console.error(e);
            }
        });
    }

    onEnable() {
        this.startRecording();
    }

    onDisable() {
        this.stopRecording();
    }
}

export const Clipping = new ClippingManager();
