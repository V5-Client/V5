import { BufferedInputStream, URL, FileOutputStream, File } from '../../Utility/Constants';
import { Links } from '../../Utility/Constants';
import { Chat } from '../../Utility/Chat';

export const fetchURL = (url) => {
    try {
        let URL = new java.net.URL(url);
        let conn = URL.openConnection();
        let reader = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
        let inputLine;
        let response = '';
        while ((inputLine = reader.readLine()) != null) {
            response += inputLine + '\n';
        }
        reader.close();
        return response;
    } catch (e) {
        return null;
    }
};

export function downloadFile(fileURL, savePath) {
    try {
        if (fileURL.startsWith('"') && fileURL.endsWith('"')) {
            fileURL = fileURL.substring(1, fileURL.length - 1);
        }

        let url = new URL(fileURL);
        let inStream = new BufferedInputStream(url.openStream());
        let outStream = new FileOutputStream(savePath);

        let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024);
        let bytesRead;

        while ((bytesRead = inStream.read(buffer, 0, 1024)) !== -1) {
            outStream.write(buffer, 0, bytesRead);
        }

        inStream.close();
        outStream.close();
    } catch (e) {
        console.error(`Failed to download file from ${fileURL}: ${e}`);
    }
}

export const createCircularImage = (originalImage) => {
    if (!originalImage) return null;

    const originalBuffered = originalImage.getImage();
    const size = Math.min(originalBuffered.getWidth(), originalBuffered.getHeight());

    const circularBuffered = new java.awt.image.BufferedImage(size, size, java.awt.image.BufferedImage.TYPE_INT_ARGB);

    const graphics = circularBuffered.createGraphics();

    graphics.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);

    graphics.setColor(java.awt.Color.WHITE);
    graphics.fillOval(0, 0, size, size);

    graphics.setComposite(java.awt.AlphaComposite.SrcAtop);

    const xOffset = (originalBuffered.getWidth() - size) / 2;
    const yOffset = (originalBuffered.getHeight() - size) / 2;
    graphics.drawImage(originalBuffered, -xOffset, -yOffset, null);

    graphics.dispose();
    return new Image(circularBuffered);
};

const profilePath = new File('config/ChatTriggers/assets/discordProfile.png');

export const returnDiscord = () => {
    try {
        if (!profilePath.exists()) {
            new Thread(() => {
                // make sure folder exists
                if (!profilePath.getParentFile().exists()) profilePath.getParentFile().mkdirs();

                const url = `${Links.BASE_API_URL}/api/v1/users/discord-profile?minecraftUsername=${Player.getName()}&serverId=${global.SESSION_SERVER_HASH}`;
                let responseText = fetchURL(url);

                if (!responseText || responseText.trim() === '') {
                    Chat.message('Failed to get a valid response for Discord PFP.');
                    return;
                }

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    Chat.message('Failed to parse Discord PFP data. Error: ' + e);
                    console.log('Invalid JSON received: ' + responseText);
                    return;
                }

                if (!data || !data.discord || !data.discord.avatar) {
                    Chat.message('Failed to download your Discord pfp: Invalid data format.');
                    return;
                }

                let avatarUrl = data.discord.avatar;
                let saveFile = new File('config/ChatTriggers/assets/discordProfile.png');

                downloadFile(avatarUrl, saveFile.getAbsolutePath());
            }).start();
        }
    } catch (error) {
        Chat.message('An unexpected error occurred while fetching Discord PFP: ' + error);
    }

    if (profilePath.exists()) {
        let avatarPath = Image.fromAsset('discordProfile.png');
        global.discordPfp = createCircularImage(avatarPath);
    }
};
