import {
    BufferedInputStream,
    URL,
    FileOutputStream,
} from '../Utility/Constants';

import { Chat } from '../Utility/Chat';
import { File, Color } from '../Utility/Constants';

export const PADDING = 10;
export const BORDER_WIDTH = 2;
export const CORNER_RADIUS = 10;

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const GuiColor = (alpha) => new Color(0.0745, 0.0941, 0.2118, alpha);

export const easeInOutQuad = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const isInside = (mouseX, mouseY, rect) =>
    mouseX >= rect.x &&
    mouseX <= rect.x + rect.width &&
    mouseY >= rect.y &&
    mouseY <= rect.y + rect.height;

export const createCircularImage = (originalImage) => {
    if (!originalImage) return null;

    const originalBuffered = originalImage.getImage();
    const size = Math.min(
        originalBuffered.getWidth(),
        originalBuffered.getHeight()
    );

    const circularBuffered = new java.awt.image.BufferedImage(
        size,
        size,
        java.awt.image.BufferedImage.TYPE_INT_ARGB
    );

    const graphics = circularBuffered.createGraphics();

    graphics.setRenderingHint(
        java.awt.RenderingHints.KEY_ANTIALIASING,
        java.awt.RenderingHints.VALUE_ANTIALIAS_ON
    );

    graphics.setColor(java.awt.Color.WHITE);
    graphics.fillOval(0, 0, size, size);

    graphics.setComposite(java.awt.AlphaComposite.SrcAtop);

    const xOffset = (originalBuffered.getWidth() - size) / 2;
    const yOffset = (originalBuffered.getHeight() - size) / 2;
    graphics.drawImage(originalBuffered, -xOffset, -yOffset, null);

    graphics.dispose();
    return new Image(circularBuffered);
};

export const fetchURL = (url) => {
    try {
        let URL = new java.net.URL(url);
        let conn = URL.openConnection();
        let reader = new java.io.BufferedReader(
            new java.io.InputStreamReader(conn.getInputStream())
        );
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

        let buffer = java.lang.reflect.Array.newInstance(
            java.lang.Byte.TYPE,
            1024
        );
        let bytesRead;

        while ((bytesRead = inStream.read(buffer, 0, 1024)) !== -1) {
            outStream.write(buffer, 0, bytesRead);
        }

        inStream.close();
        outStream.close();
    } catch (e) {}
}
const SoundCategory = net.minecraft.sound.SoundCategory;
const Identifier = net.minecraft.util.Identifier;
const SoundEvent = net.minecraft.sound.SoundEvent;

const JINGLE_BELLS = [
    12, 12, 12, 12, 12, 12, 12, 15, 8, 10, 12, 13, 13, 13, 13, 13, 12, 12, 12,
    12, 10, 10, 12, 10, 15, 12, 12, 12, 12, 12, 12, 12, 15, 8, 10, 12, 13, 13,
    13, 13, 13, 12, 12, 12, 15, 15, 13, 10, 8,
]; // use my script if you want different song

let jingleIndex = 0;

export const playClickSound = () => {
    const entry = JINGLE_BELLS[jingleIndex];

    const playNote = (note) => {
        const noteblockNote = note % 25;
        const pitch = Math.pow(2, (noteblockNote - 12) / 12);

        World.getWorld().playSoundClient(
            SoundEvent.of(Identifier.of('minecraft', 'block.note_block.pling')),
            SoundCategory.MASTER,
            0.5,
            pitch
        );
    };

    if (Array.isArray(entry)) {
        entry.forEach(playNote); // chord
    } else {
        playNote(entry);
    }

    jingleIndex = (jingleIndex + 1) % JINGLE_BELLS.length;
};

const profilePath = new File('config/ChatTriggers/assets/discordProfile.png');
export const returnDiscord = () => {
    try {
        if (!profilePath.exists()) {
            new Thread(() => {
                // make sure folder exists
                if (!profilePath.getParentFile().exists())
                    profilePath.getParentFile().mkdirs();

                // get all data
                let data = JSON.parse(
                    fetchURL(
                        `https://client.rdbt.top/api/v1/users/discord-profile?minecraftUsername=${Player.getName()}&serverId=${
                            global.APIKEY_DO_NOT_SHARE
                        }`
                    )
                );

                if (!data || !data.discord) {
                    ChatLib.chat('Failed to download your Discord pfp :(');
                    return;
                }

                // only get avatar and define file path
                let avatarUrl = data.discord.avatar;
                let saveFile = new File(
                    'config/ChatTriggers/assets/discordProfile.png'
                );

                downloadFile(avatarUrl, saveFile.getAbsolutePath());
            }).start();
        }
    } catch (error) {
        Chat.message('Failed to download your Discord pfp :(');
    }

    if (profilePath.exists()) {
        let avatarPath = Image.fromAsset('discordProfile.png');
        global.discordPfp = createCircularImage(avatarPath);
    }
};
