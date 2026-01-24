import { Utils } from '../utils/Utils';
import { Links, File, Color, NVG, SoundCategory, Identifier, SoundEvent } from '../utils/Constants';
import { Chat } from '../utils/Chat';

export const colorWithAlpha = (baseColor, alpha) => {
    let r, g, b, a;

    if (baseColor instanceof Color) {
        r = baseColor.getRed();
        g = baseColor.getGreen();
        b = baseColor.getBlue();
        a = baseColor.getAlpha();
    } else if (typeof baseColor === 'number') {
        r = (baseColor >> 16) & 0xff;
        g = (baseColor >> 8) & 0xff;
        b = baseColor & 0xff;
        const originalAlpha = (baseColor >>> 24) & 0xff;
        a = originalAlpha === 0 && baseColor !== 0 ? 255 : originalAlpha;
    } else {
        return new Color(1, 1, 1, 1).getRGB();
    }

    const finalAlpha = Math.floor(a * alpha);
    return ((finalAlpha & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
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

export const TypingState = {
    isTyping: false,
};

export const THEME = {
    BG_WINDOW: new Color(0.09, 0.1, 0.13, 1),
    BG_OVERLAY: new Color(0.06, 0.07, 0.09, 0.85),
    BG_COMPONENT: new Color(0.11, 0.12, 0.15, 1),
    BG_ELEVATED: new Color(0.13, 0.14, 0.17, 1),
    BG_INSET: new Color(0.15, 0.16, 0.19, 1),

    HOVER: new Color(0.17, 0.18, 0.22, 1),
    ACCENT: new Color(0.4, 0.7, 1, 1),
    ACCENT_GLOW: new Color(0.4, 0.7, 1, 0.2),
    ACCENT_DIM: new Color(0.4, 0.7, 1, 0.15),

    TEXT: 0xffffffff,
    TEXT_MUTED: 0xff99a3b0,
    TEXT_LINK: 0xff66b3ff,
    TEXT_DIM: new Color(0.9, 0.9, 0.9, 1),

    BORDER: new Color(0.2, 0.21, 0.24, 1),
    BORDER_ACCENT: new Color(0.4, 0.7, 1, 0.15),

    KNOB: new Color(1, 1, 1, 1),
    SWITCH_OFF: new Color(0.25, 0.26, 0.29, 1),

    TOOLTIP_BG: new Color(0.11, 0.12, 0.15, 0.98),
    TOOLTIP_TEXT: 0xfff0f0f0,
    TOOLTIP_BORDER: new Color(0.4, 0.7, 1, 0.3),

    NOTIF_BG: new Color(0.11, 0.12, 0.15, 0.95),
    NOTIF_ICON: 0xdddddd,
    NOTIF_CLOSE: 0xffaaaaaa,
    NOTIF_PROGRESS: new Color(0.4, 0.7, 1, 0.5),
    NOTIF_SUCCESS: new Color(parseInt('10b981', 16)),
    NOTIF_ERROR: new Color(parseInt('ef4444', 16)),
    NOTIF_DANGER: new Color(parseInt('ff0f0f', 16)),
    NOTIF_CHECK_IN: new Color(parseInt('84cc16', 16)),
    NOTIF_WARNING: new Color(parseInt('f59e0b', 16)),
    NOTIF_INFO: new Color(parseInt('3b82f6', 16)),
};

export const drawRect = ({ x, y, width, height, color }) => {
    const c = (color instanceof Color ? color.getRGB() : color) | 0;
    NVG.drawRect(x, y, width, height, c);
};

export const createHighlight = (options) => {
    const cfg = options || {};
    const duration = cfg.duration !== undefined ? cfg.duration : 2200;
    const pulseMs = cfg.pulseMs !== undefined ? cfg.pulseMs : 220;
    const baseAlpha = cfg.baseAlpha !== undefined ? cfg.baseAlpha : 0.14;
    const pulseAlpha = cfg.pulseAlpha !== undefined ? cfg.pulseAlpha : 0.2;
    const inset = cfg.inset !== undefined ? cfg.inset : 4;
    const borderWidth = cfg.borderWidth !== undefined ? cfg.borderWidth : 1;
    const radius = cfg.radius !== undefined ? cfg.radius : 12;
    let start = 0;

    return {
        startHighlight: () => {
            start = Date.now();
        },
        draw: ({ x, y, width, height, accentColor, accentFillColor }) => {
            if (!start) return;
            const elapsed = Date.now() - start;
            if (elapsed > duration) {
                start = 0;
                return;
            }
            const pulse = 0.5 + 0.5 * Math.sin((elapsed / pulseMs) * Math.PI * 2);
            const alpha = baseAlpha + pulseAlpha * pulse;
            drawRoundedRectangleWithBorder({
                x: x - inset,
                y: y - inset,
                width: width + inset * 2,
                height: height + inset * 2,
                radius,
                color: colorWithAlpha(accentFillColor, alpha * 0.45),
                borderWidth,
                borderColor: colorWithAlpha(accentColor, alpha),
            });
        },
    };
};

export const drawRoundedRectangle = ({ x, y, width, height, radius, color }) => {
    const c = (color instanceof Color ? color.getRGB() : color) | 0;
    NVG.drawRoundedRect(x, y, width, height, radius, c);
};

export const drawRoundedRectangleWithBorder = (r) => {
    if (r.borderWidth && r.borderWidth > 0 && r.borderColor) {
        const bw = r.borderWidth;
        const bc = (r.borderColor instanceof Color ? r.borderColor.getRGB() : r.borderColor) | 0;
        const outerRadius = r.radius + bw;
        NVG.drawRoundedRect(r.x - bw, r.y - bw, r.width + bw * 2, r.height + bw * 2, outerRadius, bc);
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

export const drawCenteredText = (text, x, width, fontSize, color, yOffset) => {
    drawText(text, x + (width - getTextWidth(text, fontSize)) / 2, yOffset, fontSize, color);
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
        console.error('V5 Caught error' + e + e.stack);
        return null;
    }
};

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
let discordPfpPath = null;

export const getDiscordPfpPath = () => discordPfpPath;

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
                    Chat.message('Failed to parse Discord PFP data. Check console for error.');
                    Chat.log('Invalid JSON received: ' + responseText);
                    console.error('V5 Caught error' + e + e.stack);
                    return;
                }

                if (!data || !data.discord || !data.discord.avatar) {
                    Chat.message('Failed to download your Discord pfp: Invalid data format.');
                    return;
                }

                let avatarUrl = data.discord.avatar;
                Utils.downloadFile(avatarUrl, profilePath.getAbsolutePath());
                discordPfpPath = profilePath.getAbsolutePath();
            }).start();
        } else {
            discordPfpPath = profilePath.getAbsolutePath();
        }
    } catch (e) {
        Chat.message('An unexpected error occurred while fetching Discord PFP: ' + e);
        console.error('V5 Caught error' + e + e.stack);
    }
};
