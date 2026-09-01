import { CLIENT_VERSION, Consumer, ScreenshotRecorder, URL } from './Constants';
import { executeAsync } from './ThreadExecutor';
import { area, getConfigFile, subArea, writeConfigFile } from './Utils';

function closeQuietly(resource) {
    if (!resource) return;
    try {
        resource.close();
    } catch (e) {
        console.error(e);
    }
}

class DiscordNotifier {
    constructor() {
        this.endpoint = null;
        this.mentionId = null;
        this.sendLoadEmbeds = true;
        this.sendFailsafeEmbeds = true;

        this.loadSettings();
        register('gameLoad', () => this.onStartup());
    }

    loadSettings() {
        try {
            const cfg = getConfigFile('webhook.json');
            if (cfg) {
                this.endpoint = cfg.url || null;
                this.mentionId = cfg.userId || null;
            }
        } catch (e) {
            console.error(e);
        }
    }

    persistSettings() {
        writeConfigFile('webhook.json', {
            url: this.endpoint,
            userId: this.mentionId,
        });
    }

    updateEndpoint(url) {
        const canonical = String(url ?? '')
            .trim()
            .split(/[?#]/)[0];
        if (canonical && !/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[^\s/]+\/?$/.test(canonical)) return false;

        this.endpoint = String(url ?? '').trim() || null;
        this.persistSettings();
        return true;
    }

    updateMention(id) {
        this.mentionId = id;
        this.persistSettings();
    }

    takeScreenshot(title = null, description = null, color, footer, ping = false) {
        const mc = Client.getMinecraft();
        const buffer = Client.getMainRenderTarget();
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
        if (!this.endpoint) return;

        const playerName = Player.getName ? Player.getName() : 'V5';
        const playerUuid = Player.getUUID ? Player.getUUID().toString().replace(/-/g, '') : '';

        executeAsync(() => {
            let connection = null;
            let writer = null;
            let response = null;

            try {
                connection = new URL(this.endpoint).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestMethod('POST');
                connection.setRequestProperty('Content-Type', 'application/json');
                connection.setRequestProperty('User-Agent', 'V5-Client/' + CLIENT_VERSION);
                connection.setDoOutput(true);

                const body = {
                    username: playerName,
                    avatar_url: 'https://minotar.net/cube/' + playerUuid + '/100.png',
                    embeds: embeds,
                };

                if (this.mentionId && shouldMention) {
                    body.content = '<@' + this.mentionId + '>';
                }

                writer = new java.io.OutputStreamWriter(connection.getOutputStream(), 'UTF-8');
                writer.write(JSON.stringify(body));
                writer.close();
                writer = null;

                response = connection.getInputStream();
            } catch (e) {
                console.error(e);
            } finally {
                closeQuietly(response);
                closeQuietly(writer);
                if (connection) connection.disconnect();
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
            footer: { text: 'V5 Client ' + CLIENT_VERSION },
        };

        if (areaName) {
            embed.description = 'Module reloaded successfully.\n**Location**: ' + areaName + ' (' + subAreaName + ')';
        } else {
            embed.description = 'Game launched with V5 module active.';
        }

        this.publish([embed]);
    }

    uploadScreenshot(file, title = 'Screenshot Captured', description, color = 0x3498db, footer = 'V5 Client', ping = false) {
        if (!this.endpoint) return;

        const playerName = Player.getName ? Player.getName() : 'V5';
        const playerUuid = Player.getUUID ? Player.getUUID().toString().replace(/-/g, '') : '';

        executeAsync(() => {
            let connection = null;
            let out = null;
            let writer = null;
            let fis = null;
            let response = null;

            try {
                const boundary = '----------' + java.lang.Long.toString(java.lang.System.currentTimeMillis(), 16);
                connection = new URL(this.endpoint).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setDoOutput(true);
                connection.setRequestMethod('POST');
                connection.setRequestProperty('Content-Type', 'multipart/form-data; boundary=' + boundary);

                out = connection.getOutputStream();
                writer = new java.io.PrintWriter(new java.io.OutputStreamWriter(out, 'UTF-8'), true);

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
                            footer: { text: footer + ' ' + CLIENT_VERSION },
                        },
                    ],
                };

                writer.append(JSON.stringify(embedPayload)).append('\r\n');

                writer.append('--' + boundary).append('\r\n');
                writer.append('Content-Disposition: form-data; name="file"; filename="' + filename + '"').append('\r\n');
                writer.append('Content-Type: image/png').append('\r\n\r\n');
                writer.flush();

                fis = new java.io.FileInputStream(file);
                const buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
                let bytesRead;
                while ((bytesRead = fis.read(buffer)) !== -1) {
                    out.write(buffer, 0, bytesRead);
                }
                out.flush();

                writer
                    .append('\r\n')
                    .append('--' + boundary + '--')
                    .append('\r\n');
                writer.close();
                writer = null;
                out = null;
                response = connection.getInputStream();
            } catch (e) {
                console.error('Webhook upload failed: ' + e);
            } finally {
                closeQuietly(response);
                closeQuietly(fis);
                closeQuietly(writer);
                closeQuietly(out);
                if (connection) connection.disconnect();
            }
        });
    }
}

export const Webhook = new DiscordNotifier();
