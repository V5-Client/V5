import { CLIENT_VERSION, Consumer, ScreenshotRecorder, URL } from './Constants';
import { executeAsync } from './ThreadExecutor';
import { area, getConfigFile, subArea, writeConfigFile } from './Utils';

class DiscordNotifier {
    constructor() {
        this.endpoint = null;
        this.mentionId = null;
        this.active = false;
        this.clientVersion = CLIENT_VERSION;
        this.sendLoadEmbeds = true;
        this.sendFailsafeEmbeds = true;

        this.loadSettings();
        this.initTriggers();
    }

    loadSettings() {
        try {
            const cfg = getConfigFile('webhook.json');
            if (cfg) {
                this.endpoint = cfg.url || null;
                this.mentionId = cfg.userId || null;
                this.active = !!this.endpoint;

                if (this.active) return { url: this.endpoint, userId: this.mentionId };
            }
        } catch (e) {
            console.error(e);
        }
    }

    persistSettings() {
        try {
            writeConfigFile('webhook.json', {
                url: this.endpoint,
                userId: this.mentionId,
            });
        } catch (e) {
            console.error(e);
        }
    }

    initTriggers() {
        register('gameLoad', () => this.onStartup());
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

    takeScreenshot(title = null, description = null, color, footer, ping = false) {
        const mc = Client.getMinecraft();
        const buffer = mc.getMainRenderTarget();
        const gameDir = mc.gameDirectory;

        try {
            ScreenshotRecorder.grab(
                gameDir,
                buffer,
                new Consumer({
                    accept: () => {
                        Client.scheduleTask(2, () => {
                            const screenshotDir = new java.io.File(gameDir, 'screenshots');
                            const files = screenshotDir.listFiles();
                            if (!files || files.length === 0) return;

                            const latestFile = java.util.Arrays.stream(files)
                                .filter((f) => f.getName().endsWith('.png'))
                                .max(java.util.Comparator.comparingLong((f) => f.lastModified()))
                                .orElse(null);
                            if (!latestFile) return;

                            const finalTitle = title || 'Screenshot captured from ' + area();

                            this.uploadScreenshot(latestFile, finalTitle, description, color, footer, ping);
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

        const playerName = Player.getName ? Player.getName() : 'V5';
        const playerUuid = Player.getUUID ? Player.getUUID().toString().replace(/-/g, '') : '';

        executeAsync(() => {
            try {
                const connection = new URL(this.endpoint).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestMethod('POST');
                connection.setRequestProperty('Content-Type', 'application/json');
                connection.setRequestProperty('User-Agent', 'V5-Client/' + this.clientVersion);
                connection.setDoOutput(true);

                const body = {
                    username: playerName,
                    avatar_url: 'https://minotar.net/cube/' + playerUuid + '/100.png',
                    embeds: embeds,
                };

                if (this.mentionId && shouldMention) {
                    body.content = '<@' + this.mentionId + '>';
                }

                const writer = new java.io.OutputStreamWriter(connection.getOutputStream(), 'UTF-8');
                writer.write(JSON.stringify(body));
                writer.close();

                connection.getInputStream().close();
            } catch (e) {
                console.error(e);
            }
        });
    }

    onStartup() {
        if (!this.sendLoadEmbeds) return;
        const areaName = area();
        const subAreaName = subArea();

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

    setFailsafeEmbeds(value) {
        this.sendFailsafeEmbeds = !!value;
    }

    publishFailsafe(embeds, shouldMention = true) {
        if (!this.sendFailsafeEmbeds) return;
        this.publish(embeds, shouldMention);
    }

    takeFailsafeScreenshot(title = null, description = null, color, footer, ping = false) {
        if (!this.sendFailsafeEmbeds) return;
        this.takeScreenshot(title, description, color, footer, ping);
    }

    uploadScreenshot(file, title = 'Screenshot Captured', description, color = 0x3498db, footer = 'V5 Client', ping = false) {
        if (!this.endpoint || !this.active) return;

        const playerName = Player.getName ? Player.getName() : 'V5';
        const playerUuid = Player.getUUID ? Player.getUUID().toString().replace(/-/g, '') : '';

        executeAsync(() => {
            try {
                const boundary = '----------' + java.lang.Long.toString(java.lang.System.currentTimeMillis(), 16);
                const connection = new URL(this.endpoint).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
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
                    username: playerName,
                    avatar_url: 'https://minotar.net/cube/' + playerUuid + '/100.png',
                    content: ping ? (this.mentionId ? '<@' + this.mentionId + '>' : '') : '',
                    embeds: [
                        {
                            title: title,
                            description: description,
                            color: color,
                            image: {
                                url: 'attachment://' + filename,
                            },
                            timestamp: new Date().toISOString(),
                            footer: { text: footer + ' ' + this.clientVersion },
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
                connection.getInputStream().close();
            } catch (e) {
                console.error('Webhook upload failed: ' + e);
            }
        });
    }
}

const notifier = new DiscordNotifier();

export const setWebhook = (url) => notifier.updateEndpoint(url);
export const setWebhookUserId = (id) => notifier.updateMention(id);
export const sendEmbed = (embeds, shouldMention) => notifier.publish(embeds, shouldMention);
export const sendFailsafeEmbed = (embeds, shouldMention) => notifier.publishFailsafe(embeds, shouldMention);
export const getWebhookData = () => notifier.loadSettings();
export const setLoadEmbedsEnabled = (enabled) => notifier.setLoadEmbeds(enabled);
export const setFailsafeEmbedsEnabled = (enabled) => notifier.setFailsafeEmbeds(enabled);
export const sendScreenshot = (...args) => notifier.takeScreenshot(...args);
export const sendFailsafeScreenshot = (...args) => notifier.takeFailsafeScreenshot(...args);
