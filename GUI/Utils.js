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
    DROPDOWN_BACKGROUND: new Color(0.18, 0.18, 0.22, 1),
    DROPDOWN_FOREGROUND: new Color(0.65, 0.4, 0.85, 0.9),
    DROPDOWN_TEXT: 0xffffff,
    DROPDOWN_OPTION_BACKGROUND: new Color(0.22, 0.23, 0.27, 1),
    DROPDOWN_TOGGLE_DISABLED: new Color(0.35, 0.36, 0.4, 1),

    // GuiDraw
    GUI_DRAW_BACKGROUND_BORDER: new Color(1, 1, 1, 0.22),
    GUI_DRAW_BACKGROUND: new Color(0.09, 0.1, 0.13, 0.38),
    GUI_DRAW_PANELS: new Color(0.23, 0.24, 0.26, 1),
    GUI_DRAW_BORDER: new Color(1, 1, 1, 0.18),

    // GuiManager
    GUI_MANAGER_CATEGORY_TITLE: 0xffffff,
    GUI_MANAGER_CATEGORY_DESCRIPTION: 0xaaaaaa,
    GUI_MANAGER_BACK_TEXT: 0xccb380e6,
    GUI_MANAGER_CATEGORY_BOX: new Color(0.23, 0.24, 0.26, 1),
    GUI_MANAGER_UNIVERSAL_GRAY: new Color(0.28, 0.29, 0.32, 1),
    GUI_MANAGER_CATEGORY_SELECTED: new Color(0.502, 0.302, 0.702, 0.35),
    GUI_MANAGER_CATEGORY_BOX_BORDER: new Color(1, 1, 1, 0.22),

    // NotificationManager
    NOTIFICATION_BACKGROUND: new Color(0.15, 0.16, 0.21, 0.92),
    NOTIFICATION_ICON_BACKGROUND: new Color(1, 1, 1, 0.06),
    NOTIFICATION_ICON_SYMBOL: 0xdddddd,
    NOTIFICATION_TEXT: 0xffffff,
    NOTIFICATION_DESCRIPTION: 0xb0b0b0,
    NOTIFICATION_CLOSE_BUTTON: 0xaaaaaa,
    NOTIFICATION_CLOSE_BUTTON_HOVER: new Color(1, 1, 1, 0.08),
    NOTIFICATION_PROGRESS_BAR: new Color(1, 1, 1, 0.25),
    NOTIFICATION_SUCCESS: new Color(parseInt('2b9875', 16)),
    NOTIFICATION_ERROR: new Color(parseInt('ef4444', 16)),
    NOTIFICATION_DANGER: new Color(parseInt('ff0f0f', 16)),
    NOTIFICATION_CHECK_IN: new Color(parseInt('99cc33', 16)),
    NOTIFICATION_WARNING: new Color(parseInt('f59e0b', 16)),
    NOTIFICATION_INFO: new Color(parseInt('3b82f6', 16)),

    // Slider
    SLIDER_BACKGROUND: new Color(0.22, 0.22, 0.25, 1),
    SLIDER_TEXT: new Color(1, 1, 1, 1),
    SLIDER_FOREGROUND: new Color(0.502, 0.302, 0.702, 0.8),
    SLIDER_HANDLE: new Color(0.85, 0.85, 0.85, 1),
    SLIDER_BAR_BACKGROUND: new Color(0.14, 0.14, 0.16, 1),

    // Toggle
    TOGGLE_BACKGROUND: new Color(0.22, 0.22, 0.25, 1),
    TOGGLE_ACCENT: new Color(0.502, 0.302, 0.702, 0.8),
    TOGGLE_DISABLED_BOX: new Color(0.38, 0.39, 0.42, 1),
    TOGGLE_TEXT: new Color(1, 1, 1, 1),
    TOGGLE_BORDER: new Color(1, 1, 1, 0.22),

    // Tooltip
    TOOLTIP_BACKGROUND: new Color(0.12, 0.13, 0.15, 0.95),
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

                const url = `${
                    Links.BASE_API_URL
                }/api/v1/users/discord-profile?minecraftUsername=${Player.getName()}&serverId=${
                    global.SESSION_SERVER_HASH
                }`;
                let responseText = fetchURL(url);

                if (!responseText || responseText.trim() === '') {
                    Chat.message(
                        'Failed to get a valid response for Discord PFP.'
                    );
                    return;
                }

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    Chat.message(
                        'Failed to parse Discord PFP data. Error: ' + e
                    );
                    console.log('Invalid JSON received: ' + responseText);
                    return;
                }

                if (!data || !data.discord || !data.discord.avatar) {
                    Chat.Message(
                        'Failed to download your Discord pfp: Invalid data format.'
                    );
                    return;
                }

                let avatarUrl = data.discord.avatar;
                let saveFile = new File(
                    'config/ChatTriggers/assets/discordProfile.png'
                );

                downloadFile(avatarUrl, saveFile.getAbsolutePath());
            }).start();
        }
    } catch (error) {
        Chat.message(
            'An unexpected error occurred while fetching Discord PFP: ' + error
        );
    }

    if (profilePath.exists()) {
        let avatarPath = Image.fromAsset('discordProfile.png');
        global.discordPfp = createCircularImage(avatarPath);
    }
};
