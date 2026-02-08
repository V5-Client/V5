import { Utils } from './Utils';
import { Chat } from './Chat';
import {
    URL,
    DataOutputStream,
    Toolkit,
    DataFlavor,
    CLIENT_VERSION,
    NativeImage,
    BufferedImage,
    File,
    FileInputStream,
    Consumer,
    ScreenshotRecorder,
} from './Constants';
import { Executor } from './ThreadExecutor';
import { v5Command } from './V5Commands';

class DiscordNotifier {
    constructor() {
        this.endpoint = null;
        this.mentionId = null;
        this.active = false;
        this.clientVersion = CLIENT_VERSION;
        this.sendLoadEmbeds = true;

        this.loadSettings();
        this.initTriggers();
    }

    loadSettings() {
        try {
            const cfg = Utils.getConfigFile('webhook.json');
            if (cfg) {
                this.endpoint = cfg.url || null;
                this.mentionId = cfg.userId || null;
                this.active = !!this.endpoint;

                if (this.active) return { url: this.endpoint, id: this.mentionId };
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            Chat.messageDebug('Failed to initialize webhook settings.');
        }
    }

    persistSettings() {
        try {
            Utils.writeConfigFile('webhook.json', {
                url: this.endpoint,
                userId: this.mentionId,
            });
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    initTriggers() {
        register('gameLoad', () => this.onStartup());

        v5Command('setwh', () => {
            try {
                const clipboard = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
                this.updateEndpoint(clipboard);
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
                Chat.message('Webhook: &cCould not access system clipboard.');
            }
        });

        v5Command('setid', (uid) => {
            if (!uid) {
                Chat.message('&cUsage: /v5 webhook userid <id>');
                return;
            }
            this.updateMention(uid);
        });
    }

    updateEndpoint(url) {
        if (!url || !url.startsWith('https://discord.com/api/webhooks/')) return;

        this.endpoint = url;
        this.active = true;
        this.persistSettings();
    }

    updateMention(id) {
        this.mentionId = id;
        this.persistSettings();
    }

    takeScreenshot(title = null, duration = null) {
        const mc = Client.getMinecraft();
        const buffer = mc.getFramebuffer();
        const gameDir = mc.runDirectory;

        try {
            ScreenshotRecorder.saveScreenshot(
                gameDir,
                buffer,
                new Consumer({
                    accept: (message) => {
                        Client.scheduleTask(2, () => {
                            const screenshotDir = new java.io.File(gameDir, 'screenshots');
                            const files = screenshotDir.listFiles();
                            if (!files || files.length === 0) return;

                            const latestFile = java.util.Arrays.stream(files)
                                .filter((f) => f.getName().endsWith('.png'))
                                .max(java.util.Comparator.comparingLong((f) => f.lastModified()))
                                .get();

                            const finalTitle = title || 'Screenshot captured from ' + Utils.area();

                            notifier.uploadScreenshot(latestFile, finalTitle, duration);
                        });
                    },
                })
            );
        } catch (e) {
            console.error('Screenshot Command Error: ' + e);
        }
    }

    publish(embeds, shouldMention = true) {
        if (!this.endpoint || !this.active) return;

        Executor.execute(() => {
            try {
                const connection = new URL(this.endpoint).openConnection();
                connection.setRequestMethod('POST');
                connection.setRequestProperty('Content-Type', 'application/json');
                connection.setRequestProperty('User-Agent', 'V5-Client/' + this.clientVersion);
                connection.setDoOutput(true);

                const playerUuid = Player.getUUID().toString().replace(/-/g, '');
                const body = {
                    username: Player.getName(),
                    avatar_url: 'https://minotar.net/cube/' + playerUuid + '/100.png',
                    embeds: embeds,
                };

                if (this.mentionId && shouldMention) {
                    body.content = '<@' + this.mentionId + '>';
                }

                const stream = new DataOutputStream(connection.getOutputStream());
                stream.writeBytes(JSON.stringify(body));
                stream.flush();
                stream.close();

                connection.getInputStream();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
                Chat.messageDebug('Webhook transmission failed: ' + e);
            }
        });
    }

    onStartup() {
        if (!this.sendLoadEmbeds) return;
        const areaName = Utils.area();
        const subAreaName = Utils.subArea();

        const embed = {
            title: areaName ? '**Client Initialized**' : '**Environment Loaded**',
            color: 0x3498db,
            timestamp: new Date().toISOString(),
            footer: { text: 'V5 Client ' + this.clientVersion },
        };

        if (areaName) {
            embed.description = 'Module reloaded successfully.\n**Location**: ' + areaName + ' (' + subAreaName + ')';
        } else {
            embed.description = 'Game launched with V5 module active.';
        }

        this.publish([embed]);
    }

    setLoadEmbeds(value) {
        this.sendLoadEmbeds = value;
    }

    uploadScreenshot(file, title = 'Screenshot Captured', duration = '') {
        if (!this.endpoint || !this.active) return;

        Executor.execute(() => {
            try {
                const boundary = '----------' + java.lang.Long.toString(java.lang.System.currentTimeMillis(), 16);
                const connection = new java.net.URL(this.endpoint).openConnection();
                connection.setDoOutput(true);
                connection.setRequestMethod('POST');
                connection.setRequestProperty('Content-Type', 'multipart/form-data; boundary=' + boundary);

                const out = connection.getOutputStream();
                const writer = new java.io.PrintWriter(new java.io.OutputStreamWriter(out, 'UTF-8'), true);

                writer.append('--' + boundary).append('\r\n');
                writer.append('Content-Disposition: form-data; name="payload_json"').append('\r\n');
                writer.append('Content-Type: application/json').append('\r\n\r\n');

                const filename = file.getName();
                const embedPayload = {
                    username: Player.getName(),
                    avatar_url: 'https://minotar.net/cube/' + Player.getUUID().toString().replace(/-/g, '') + '/100.png',
                    content: this.mentionId ? '<@' + this.mentionId + '>' : '',
                    embeds: [
                        {
                            title: title,
                            description: duration ? `**Runtime:** ${duration}` : '',
                            color: 0x3498db,
                            image: {
                                url: 'attachment://' + filename,
                            },
                            timestamp: new Date().toISOString(),
                            footer: { text: 'V5 Client ' + this.clientVersion },
                        },
                    ],
                };

                writer.append(JSON.stringify(embedPayload)).append('\r\n');

                writer.append('--' + boundary).append('\r\n');
                writer.append('Content-Disposition: form-data; name="file"; filename="' + filename + '"').append('\r\n');
                writer.append('Content-Type: image/png').append('\r\n\r\n');
                writer.flush();

                const fis = new java.io.FileInputStream(file);
                const buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
                let bytesRead;
                while ((bytesRead = fis.read(buffer)) !== -1) {
                    out.write(buffer, 0, bytesRead);
                }
                out.flush();
                fis.close();

                writer
                    .append('\r\n')
                    .append('--' + boundary + '--')
                    .append('\r\n');
                writer.close();
                connection.getInputStream();
            } catch (e) {
                console.error('Webhook upload failed: ' + e);
            }
        });
    }
}

export const notifier = new DiscordNotifier();

export const Webhook = {
    setWebhook: (url) => notifier.updateEndpoint(url),
    setUserId: (id) => notifier.updateMention(id),
    sendEmbed: (e, p) => notifier.publish(e, p),
    getData: () => notifier.loadSettings(),
    sendLoadEmbeds: (v) => notifier.setLoadEmbeds(v),
    sendScreenshot: (t, d) => notifier.takeScreenshot(t, d),
};
