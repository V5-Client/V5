import { chat } from './Chat';
import { BufferedReader, File, InputStreamReader, Links, StandardCharsets, URL, globalAssetsDir } from './Constants';
import { streamDownloadToFile } from './FileUtils';
import { executeAsync, scheduleClient } from './ThreadExecutor';

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
            executeAsync((generation) => {
                if (!profilePath.getParentFile().exists()) profilePath.getParentFile().mkdirs();

                const responseText = fetchURL(`${Links.BASE_API_URL}/api/me`, {
                    Authorization: `Bearer ${authToken}`,
                });

                if (!responseText || responseText.trim() === '') {
                    scheduleClient(() => chat('Failed to get a valid response for Discord PFP.'), 0, generation);
                    return;
                }

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    scheduleClient(() => chat('Failed to parse Discord PFP data. Check console for error.'), 0, generation);
                    console.log('Invalid JSON received: ' + responseText);
                    console.error('V5 Caught error' + e + e.stack);
                    return;
                }

                if (!data || !data.discord || !data.discord.avatar) {
                    scheduleClient(() => chat('Failed to download your Discord pfp: Invalid data format.'), 0, generation);
                    return;
                }

                try {
                    streamDownloadToFile(data.discord.avatar, profilePath.getAbsolutePath());
                    scheduleClient(
                        () => {
                            discordPfpPath = profilePath.getAbsolutePath();
                        },
                        0,
                        generation
                    );
                } catch (e) {
                    scheduleClient(
                        () => {
                            chat('Download failed: ' + e);
                            console.error('V5 Caught error' + e + e.stack);
                        },
                        0,
                        generation
                    );
                }
            });
        } else {
            discordPfpPath = profilePath.getAbsolutePath();
        }
    } catch (e) {
        chat('An unexpected error occurred while fetching Discord PFP: ' + e);
        console.error('V5 Caught error' + e + e.stack);
    }
};
