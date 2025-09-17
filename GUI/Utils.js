import {
    BufferedInputStream,
    URL,
    FileOutputStream,
} from '../Utility/Constants';

import { Links } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';
import { File, Color, UIRoundedRectangle, Matrix } from '../Utility/Constants';

export const colorWithAlpha = (baseColor, alpha) =>
    new Color(
        baseColor.getRed() / 255,
        baseColor.getGreen() / 255,
        baseColor.getBlue() / 255,
        (baseColor.getAlpha() / 255) * alpha
    );

export const PADDING = 10;
export const BORDER_WIDTH = 0.5;
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

export const THEME = {
    // Dropdown
    DROPDOWN_BACKGROUND: new Color(0.15, 0.15, 0.15, 1),
    DROPDOWN_FOREGROUND: new Color(0.6, 0.3, 0.8, 0.8),
    DROPDOWN_TEXT: 0xffffff,
    DROPDOWN_OPTION_BACKGROUND: new Color(0.2, 0.2, 0.2, 1),
    DROPDOWN_TOGGLE_DISABLED: new Color(0.4, 0.4, 0.4, 1),

    // GuiDraw
    GUI_DRAW_BACKGROUND_BORDER: new Color(0.1, 0.1, 0.1, 0.2),
    GUI_DRAW_BACKGROUND: new Color(0.1, 0.1, 0.1, 0.5),
    GUI_DRAW_PANELS: new Color(0.2, 0.2, 0.21, 1),
    GUI_DRAW_BORDER: new Color(1, 1, 1, 0.2),

    // GuiManager
    GUI_MANAGER_CATEGORY_TITLE: 0xffffff,
    GUI_MANAGER_CATEGORY_DESCRIPTION: 0xaaaaaa,
    GUI_MANAGER_BACK_TEXT: 0xccb380e6,
    GUI_MANAGER_CATEGORY_BOX: new Color(0.2, 0.2, 0.21, 1),
    GUI_MANAGER_UNIVERSAL_GRAY: new Color(0.25, 0.25, 0.25, 1),
    GUI_MANAGER_CATEGORY_SELECTED: new Color(0.502, 0.302, 0.702, 0.3),
    GUI_MANAGER_CATEGORY_BOX_BORDER: new Color(1, 1, 1, 0.2),

    // NotificationManager
    NOTIFICATION_BACKGROUND: new Color(0x23 / 255, 0x25 / 255, 0x31 / 255, 0.9),
    NOTIFICATION_ICON_BACKGROUND: new Color(1, 1, 1, 0.05),
    NOTIFICATION_ICON_SYMBOL: 0xdddddd,
    NOTIFICATION_TEXT: 0xffffff,
    NOTIFICATION_DESCRIPTION: 0x808080,
    NOTIFICATION_CLOSE_BUTTON: 0x999999,
    NOTIFICATION_CLOSE_BUTTON_HOVER: new Color(1, 1, 1, 0.05),
    NOTIFICATION_PROGRESS_BAR: new Color(1, 1, 1, 0.2),
    NOTIFICATION_SUCCESS: new Color(parseInt('2b9875', 16)),
    NOTIFICATION_ERROR: new Color(parseInt('ef4444', 16)),
    NOTIFICATION_DANGER: new Color(parseInt('ff0f0f', 16)),
    NOTIFICATION_CHECK_IN: new Color(parseInt('99cc33', 16)),
    NOTIFICATION_WARNING: new Color(parseInt('f59e0b', 16)),
    NOTIFICATION_INFO: new Color(parseInt('3b82f6', 16)),

    // Slider
    SLIDER_BACKGROUND: new Color(0.1935, 0.1931, 0.2092, 1),
    SLIDER_TEXT: new Color(1, 1, 1, 1),
    SLIDER_FOREGROUND: new Color(0.502, 0.302, 0.702, 0.75),
    SLIDER_HANDLE: new Color(0.8, 0.8, 0.8, 1),
    SLIDER_BAR_BACKGROUND: new Color(0.11, 0.11, 0.11, 1),

    // Toggle
    TOGGLE_BACKGROUND: new Color(0.1935, 0.1931, 0.2092, 1),
    TOGGLE_ACCENT: new Color(0.502, 0.302, 0.702, 0.75),
    TOGGLE_DISABLED_BOX: new Color(0.3, 0.3, 0.3, 1),
    TOGGLE_TEXT: new Color(1, 1, 1, 1),
    TOGGLE_BORDER: new Color(1, 1, 1, 0.2),

    // Tooltip
    TOOLTIP_BACKGROUND: new Color(0.1, 0.1, 0.1, 0.95),
    TOOLTIP_TEXT: 0xdddddd,
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
                        `${
                            Links.BASE_API_URL
                        }/api/v1/users/discord-profile?minecraftUsername=${Player.getName()}&serverId=${
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
