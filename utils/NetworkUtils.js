import { chat } from './Chat';
import { BufferedReader, File, InputStreamReader, Links, StandardCharsets, URL, globalAssetsDir } from './Constants';
import { downloadFile } from './FileUtils';

const fetchURL = (url, headers = {}) => {
    try {
        const conn = new URL(url).openConnection();
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        Object.keys(headers).forEach((key) => {
            const value = headers[key];
            if (value !== undefined && value !== null) {
                conn.setRequestProperty(String(key), String(value));
            }
        });
        const reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        let inputLine;
        let response = '';
        while ((inputLine = reader.readLine()) != null) {
            response += inputLine + '\n';
        }
        reader.close();
        return response;
    } catch (e) {
        console.error('V5 Caught error' + e + e.stack);
        return null;
    }
};

const profilePath = new File(globalAssetsDir, 'discordProfile.png');
let discordPfpPath = null;

export const getDiscordPfpPath = () => discordPfpPath;

export const returnDiscord = (authToken) => {
    try {
        if (!profilePath.exists()) {
            const t = new java.lang.Thread(() => {
                if (!profilePath.getParentFile().exists()) profilePath.getParentFile().mkdirs();

                const responseText = fetchURL(`${Links.BASE_API_URL}/api/me`, {
                    Authorization: `Bearer ${authToken}`,
                });

                if (!responseText || responseText.trim() === '') {
                    chat('messages.runtime.failedToGetAValidResponseForDiscordPfp');
                    return;
                }

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    chat('messages.runtime.failedToParseDiscordPfpDataCheckConsoleForError');
                    console.log('Invalid JSON received: ' + responseText);
                    console.error('V5 Caught error' + e + e.stack);
                    return;
                }

                if (!data || !data.discord || !data.discord.avatar) {
                    chat('messages.runtime.failedToDownloadYourDiscordPfpInvalidDataFormat');
                    return;
                }

                downloadFile(data.discord.avatar, profilePath.getAbsolutePath(), {
                    onComplete: () => {
                        discordPfpPath = profilePath.getAbsolutePath();
                    },
                    onError: (e) => {
                        chat('messages.network.downloadFailed', { error: e });
                        console.error('V5 Caught error' + e + e.stack);
                    },
                });
            });
            t.setDaemon(true);
            t.start();
        } else {
            discordPfpPath = profilePath.getAbsolutePath();
        }
    } catch (e) {
        chat('messages.network.discordPfpUnexpected', { error: e });
        console.error('V5 Caught error' + e + e.stack);
    }
};
