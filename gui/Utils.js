import { Utils } from '../utils/Utils';
import { Links } from '../utils/Constants';
import { Chat } from '../utils/Chat';
import { File, Color } from '../utils/Constants';

export const NVG = Java.type('com.v5.render.NVGRenderer').INSTANCE;

export const colorWithAlpha = (baseColor, alpha) => {
    if (typeof baseColor === 'number') {
        const r = (baseColor >> 16) & 0xff;
        const g = (baseColor >> 8) & 0xff;
        const b = baseColor & 0xff;
        const originalAlpha = (baseColor >> 24) & 0xff;
        const a = (originalAlpha === 0 ? 255 : originalAlpha) * alpha;
        return ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
    }
    if (baseColor instanceof Color) {
        return new Color(baseColor.getRed() / 255, baseColor.getGreen() / 255, baseColor.getBlue() / 255, (baseColor.getAlpha() / 255) * alpha);
    }
    return new Color(1, 1, 1, 1);
};

export const PADDING = 12;
export const BORDER_WIDTH = 1;
export const CORNER_RADIUS = 12;

export const CATEGORY_HEIGHT = 36;
export const CATEGORY_PADDING = 8;
export const LEFT_PANEL_TEXT_HEIGHT = 8;

export const CATEGORY_BOX_PADDING = 8;
export const ITEM_SPACING = 10;
export const SEPARATOR_HEIGHT = 24;
export const SUBCATEGORY_BUTTON_HEIGHT = 28;
export const SUBCATEGORY_BUTTON_SPACING = 8;

export const THEME = {
    // Dropdown
    DROPDOWN_BACKGROUND: new Color(0.11, 0.12, 0.15, 1),
    DROPDOWN_FOREGROUND: new Color(0.4, 0.7, 1, 1),
    DROPDOWN_TEXT: 0xffffffff,
    DROPDOWN_OPTION_BACKGROUND: new Color(0.13, 0.14, 0.17, 1),
    DROPDOWN_TOGGLE_DISABLED: new Color(0.25, 0.26, 0.29, 1),

    // GuiDraw
    GUI_DRAW_BACKGROUND_BORDER: new Color(0.4, 0.7, 1, 0.2),
    GUI_DRAW_BACKGROUND: new Color(0.06, 0.07, 0.09, 0.85),
    GUI_DRAW_PANELS: new Color(0.09, 0.1, 0.13, 1),
    GUI_DRAW_BORDER: new Color(0.4, 0.7, 1, 0.15),

    // GuiManager
    GUI_MANAGER_CATEGORY_TITLE: 0xffffffff,
    GUI_MANAGER_CATEGORY_DESCRIPTION: 0xff99a3b0,
    GUI_MANAGER_BACK_TEXT: 0xff66b3ff,
    GUI_MANAGER_CATEGORY_BOX: new Color(0.11, 0.12, 0.15, 1),
    GUI_MANAGER_CATEGORY_BOX_HOVER: new Color(0.17, 0.18, 0.22, 1),
    GUI_MANAGER_UNIVERSAL_GRAY: new Color(0.15, 0.16, 0.19, 1),
    GUI_MANAGER_CATEGORY_SELECTED: new Color(0.4, 0.7, 1, 0.15),
    GUI_MANAGER_CATEGORY_BOX_BORDER: new Color(0.2, 0.21, 0.24, 1),

    // NotificationManager
    NOTIFICATION_BACKGROUND: new Color(0.11, 0.12, 0.15, 0.95),
    NOTIFICATION_ICON_BACKGROUND: new Color(0.15, 0.16, 0.19, 1),
    NOTIFICATION_ICON_SYMBOL: 0xdddddd,
    NOTIFICATION_TEXT: 0xffffffff,
    NOTIFICATION_DESCRIPTION: 0xff99a3b0,
    NOTIFICATION_CLOSE_BUTTON: 0xffaaaaaa,
    NOTIFICATION_CLOSE_BUTTON_HOVER: new Color(1, 1, 1, 0.1),
    NOTIFICATION_PROGRESS_BAR: new Color(0.4, 0.7, 1, 0.5),
    NOTIFICATION_SUCCESS: new Color(parseInt('10b981', 16)),
    NOTIFICATION_ERROR: new Color(parseInt('ef4444', 16)),
    NOTIFICATION_DANGER: new Color(parseInt('ff0f0f', 16)),
    NOTIFICATION_CHECK_IN: new Color(parseInt('84cc16', 16)),
    NOTIFICATION_WARNING: new Color(parseInt('f59e0b', 16)),
    NOTIFICATION_INFO: new Color(parseInt('3b82f6', 16)),

    // Slider
    SLIDER_BACKGROUND: new Color(0.11, 0.12, 0.15, 1),
    SLIDER_TEXT: new Color(1, 1, 1, 1),
    SLIDER_FOREGROUND: new Color(0.4, 0.7, 1, 1),
    SLIDER_HANDLE: new Color(1, 1, 1, 1),
    SLIDER_BAR_BACKGROUND: new Color(0.15, 0.16, 0.19, 1),
    SLIDER_VALUE_BG: new Color(0.15, 0.16, 0.19, 1),
    SLIDER_VALUE_TEXT: new Color(0.9, 0.9, 0.9, 1),

    // Toggle
    TOGGLE_BACKGROUND: new Color(0.11, 0.12, 0.15, 1),
    TOGGLE_ACCENT: new Color(0.4, 0.7, 1, 1),
    TOGGLE_SWITCH_ON: new Color(0.4, 0.7, 1, 1),
    TOGGLE_SWITCH_OFF: new Color(0.25, 0.26, 0.29, 1),
    TOGGLE_SWITCH_KNOB: new Color(1, 1, 1, 1),
    TOGGLE_TEXT: new Color(1, 1, 1, 1),
    TOGGLE_BORDER: new Color(0.2, 0.21, 0.24, 1),

    // Tooltip
    TOOLTIP_BACKGROUND: new Color(0.11, 0.12, 0.15, 0.98),
    TOOLTIP_TEXT: 0xfff0f0f0,
    TOOLTIP_BORDER: new Color(0.4, 0.7, 1, 0.3),
};

export const drawRect = ({ x, y, width, height, color }) => {
    const c = (color instanceof Color ? color.getRGB() : color) | 0;
    NVG.drawRect(x, y, width, height, c);
};

export const drawRoundedRectangle = ({ x, y, width, height, radius, color }) => {
    const c = (color instanceof Color ? color.getRGB() : color) | 0;
    NVG.drawRoundedRect(x, y, width, height, radius, c);
};

export const drawRoundedRectangleWithBorder = (r) => {
    if (r.borderWidth && r.borderWidth > 0 && r.borderColor) {
        const bw = r.borderWidth;
        const bc = (r.borderColor instanceof Color ? r.borderColor.getRGB() : r.borderColor) | 0;
        NVG.drawRoundedRect(r.x - bw, r.y - bw, r.width + bw * 2, r.height + bw * 2, r.radius, bc);
    }
    const c = (r.color instanceof Color ? r.color.getRGB() : r.color) | 0;
    NVG.drawRoundedRect(r.x, r.y, r.width, r.height, r.radius, c);
};

export const drawShadow = (x, y, width, height, radius = 8, intensity = 0.15) => {
    const shadowColor = new Color(0, 0, 0, intensity).getRGB() | 0;
    NVG.drawDropShadow(x, y, width, height, radius, 10, 0, shadowColor);
};

export const drawText = (text, x, y, size, color, align = 17) => {
    const c = (color instanceof Color ? color.getRGB() : color) | 0;
    NVG.text(text, x, y, size, c, NVG.getDefaultFont(), align);
};

export const getTextWidth = (text, size) => {
    return NVG.textWidth(text, size, NVG.getDefaultFont());
};

export const drawImage = (path, x, y, width, height, radius = 0, alpha = 1) => {
    if (!path) return;
    NVG.drawImage(path, x, y, width, height, radius, alpha);
};

export const drawCircularImage = (path, x, y, size, alpha = 1) => {
    if (!path) return;
    NVG.drawImage(path, x, y, size, size, size / 2, alpha);
};

export const scissor = (x, y, w, h) => {
    NVG.scissor(x, y, w, h);
};

export const resetScissor = () => {
    NVG.resetScissor();
};

export const composite = (op) => {
    NVG.setGlobalCompositeOperation(op);
};

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const FontSizes = {
    TINY: 6,
    SMALL: 7,
    MEDIUM: 8,
    REGULAR: 9,
    LARGE: 10,
    HEADER: 11,
};

export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const easeOutBack = (x) => {
    const c1 = 1;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export const isInside = (mouseX, mouseY, rect) => mouseX >= rect.x && mouseX <= rect.x + rect.width && mouseY >= rect.y && mouseY <= rect.y + rect.height;

export const fetchURL = (url) => {
    try {
        let conn = new java.net.URL(url).openConnection();
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

const SoundCategory = net.minecraft.sound.SoundCategory;
const Identifier = net.minecraft.util.Identifier;
const SoundEvent = net.minecraft.sound.SoundEvent;

const JINGLE_BELLS = [
    12, 12, 12, 12, 12, 12, 12, 15, 8, 10, 12, 13, 13, 13, 13, 13, 12, 12, 12, 12, 10, 10, 12, 10, 15, 12, 12, 12, 12, 12, 12, 12, 15, 8, 10, 12, 13, 13, 13,
    13, 13, 12, 12, 12, 15, 15, 13, 10, 8,
]; // use my script if you want different song

let jingleIndex = 0;

export const playClickSound = () => {
    const entry = JINGLE_BELLS[jingleIndex];

    const playNote = (note) => {
        const noteblockNote = note % 25;
        const pitch = Math.pow(2, (noteblockNote - 12) / 12);

        World.getWorld().playSoundClient(SoundEvent.of(Identifier.of('minecraft', 'block.note_block.pling')), SoundCategory.MASTER, 0.5, pitch);
    };

    if (Array.isArray(entry)) {
        entry.forEach(playNote); // chord
    } else {
        playNote(entry);
    }

    jingleIndex = (jingleIndex + 1) % JINGLE_BELLS.length;
};

const profilePath = new File('config/ChatTriggers/assets/discordProfile.png');
export const returnDiscord = (authToken) => {
    try {
        if (!profilePath.exists()) {
            new Thread(() => {
                // make sure folder exists
                if (!profilePath.getParentFile().exists()) profilePath.getParentFile().mkdirs();

                const url = `${Links.BASE_API_URL}/api/me?token=${authToken}`;
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
                    Chat.log('Invalid JSON received: ' + responseText);
                    return;
                }

                if (!data || !data.discord || !data.discord.avatar) {
                    Chat.message('Failed to download your Discord pfp: Invalid data format.');
                    return;
                }

                let avatarUrl = data.discord.avatar;
                Utils.downloadFile(avatarUrl, profilePath.getAbsolutePath());
                global.discordPfpPath = profilePath.getAbsolutePath();
            }).start();
        } else {
            global.discordPfpPath = profilePath.getAbsolutePath();
        }
    } catch (error) {
        Chat.message('An unexpected error occurred while fetching Discord PFP: ' + error);
    }
};
