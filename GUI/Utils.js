import {
    BufferedInputStream,
    URL,
    FileOutputStream,
} from '../Utility/Constants';

import { Chat } from '../Utility/Chat';
import { File, Color, UIRoundedRectangle, Matrix } from '../Utility/Constants';

export const PADDING = 10;
export const BORDER_WIDTH = 2;
export const CORNER_RADIUS = 10;

export const CATEGORY_HEIGHT = 30;
export const CATEGORY_PADDING = 5;
export const LEFT_PANEL_TEXT_HEIGHT = 8;
export const CATEGORY_OFFSET_Y = 50;

export const CATEGORY_BOX_PADDING = 5;
export const ITEM_SPACING = 5;
export const SEPARATOR_HEIGHT = 20;
export const SUBCATEGORY_BUTTON_HEIGHT = 20;
export const SUBCATEGORY_BUTTON_SPACING = 5;

export const COLORS = {
    WHITE: 0xffffff,
    GREY: 0xaaaaaa,
    PURPLE: 0xccb380e6,
};

export const drawRoundedRectangle = ({
    x,
    y,
    width,
    height,
    radius,
    color,
}) => {
    UIRoundedRectangle.Companion.drawRoundedRectangle(
        Matrix,
        x,
        y,
        x + width,
        y + height,
        radius,
        color
    );
};

export const drawRoundedRectangleWithBorder = (r) => {
    if (r.borderWidth && r.borderWidth > 0) {
        const bw = r.borderWidth;
        const innerWidth = Math.max(0, r.width - bw * 2);
        const innerHeight = Math.max(0, r.height - bw * 2);
        const innerRadius = Math.max(0, r.radius - bw);

        if (r.borderColor && bw > 0) {
            drawRoundedRectangle({
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                radius: r.radius,
                color: r.borderColor,
            });
        }

        if (innerWidth > 0 && innerHeight > 0) {
            drawRoundedRectangle({
                x: r.x + bw,
                y: r.y + bw,
                width: innerWidth,
                height: innerHeight,
                radius: innerRadius,
                color: r.color,
            });
        }
    } else {
        drawRoundedRectangle(r);
    }
};

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const GuiColor = (alpha) => new Color(0.0745, 0.0941, 0.2118, alpha);
export const GuiAccentColor = (alpha) => new Color(0.502, 0.302, 0.702, alpha); // i dont really like this accent but dont know what to change it to 🤷‍♂️

export const createGrey = (float, alpha) =>
    new Color(float, float, float, alpha);

export const easeInOutQuad = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutCubic = (t) => {
    return 1 - Math.pow(1 - t, 3);
};

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
