import { Utils } from './Utils';
import { Chat } from './Chat';
import { URL, DataOutputStream, Toolkit, DataFlavor, CLIENT_VERSION } from './Constants';
import { Executor } from './ThreadExecutor';

class DiscordNotifier {
    constructor() {
        this.endpoint = null;
        this.mentionId = null;
        this.active = false;
        this.clientVersion = CLIENT_VERSION;

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
            }
        } catch (e) {
            Chat.messageDebug('Failed to initialize webhook settings.');
        }
    }

    persistSettings() {
        try {
            Utils.writeConfigFile('webhook.json', {
                url: this.endpoint,
                userId: this.mentionId,
            });
        } catch (e) {}
    }

    initTriggers() {
        register('gameLoad', () => this.onStartup());

        register('command', () => {
            try {
                const clipboard = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
                this.updateEndpoint(clipboard);
            } catch (e) {
                Chat.message('Webhook: &cCould not access system clipboard.');
            }
        })
            .setName('setwh', true)
            .setAliases(['setwebhook']);

        register('command', (uid) => {
            if (!uid) {
                Chat.message('&cUsage: /setuserid <id>');
                return;
            }
            this.updateMention(uid);
        })
            .setName('setid', true)
            .setAliases(['setuserid']);
    }

    updateEndpoint(url) {
        if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
            Chat.message('&cInvalid Discord webhook format.');
            return;
        }
        this.endpoint = url;
        this.active = true;
        this.persistSettings();
        Chat.message('&aDiscord webhook endpoint updated.');
    }

    updateMention(id) {
        this.mentionId = id;
        this.persistSettings();
        Chat.message('&aDiscord user ID for mentions updated.');
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
            } catch (err) {
                Chat.messageDebug('Webhook transmission failed: ' + err);
            }
        });
    }

    onStartup() {
        const areaName = Utils.area();
        const subAreaName = Utils.subArea();

        const embed = {
            title: areaName ? '**Client Initialized**' : '**Environment Loaded**',
            color: 0x800000,
            timestamp: new Date().toISOString(),
            footer: { text: 'V5 Engine ' + this.clientVersion },
        };

        if (areaName) {
            embed.description = 'Module reloaded successfully.\n**Location**: ' + areaName + ' (' + subAreaName + ')';
        } else {
            embed.description = 'Game launched with V5 module active.';
        }

        this.publish([embed]);
    }
}

export const notifier = new DiscordNotifier();

export const Webhook = {
    setWebhook: (url) => notifier.updateEndpoint(url),
    setUserId: (id) => notifier.updateMention(id),
    sendEmbed: (e, p) => notifier.publish(e, p),
};
