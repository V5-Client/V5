import { FontSizes, PADDING, THEME, drawText, getTextWidth } from './Utils';

const CHANGELOG = FileLib.read('V5', 'changelog.md') || 'Changelog unavailable.';
let cachedLayout = null;

const getLayout = (width) => {
    if (cachedLayout?.width === width) return cachedLayout;

    const lines = [];
    let y = PADDING;

    CHANGELOG.split(/\r?\n/).forEach((source) => {
        if (!source.trim()) {
            y += 6;
            return;
        }

        const heading = source.match(/^(#{1,3})\s+(.+)$/);
        const bullet = source.match(/^[-*]\s+(.+)$/);
        const size = heading ? [FontSizes.HEADER, FontSizes.LARGE, FontSizes.REGULAR][heading[1].length - 1] : FontSizes.REGULAR;
        const color = heading ? THEME.TEXT : THEME.TEXT_MUTED;
        const prefix = bullet ? '• ' : '';
        const text = heading?.[2] || bullet?.[1] || source;
        const words = text.split(/\s+/);
        const lineHeight = size + 4;
        let line = prefix;

        if (heading && y > PADDING) y += 4;
        words.forEach((word) => {
            const next = line === prefix ? `${prefix}${word}` : `${line} ${word}`;
            if (line !== prefix && getTextWidth(next, size) > width - PADDING * 2) {
                lines.push({ text: line, y, size, color });
                y += lineHeight;
                line = bullet ? `  ${word}` : word;
            } else {
                line = next;
            }
        });
        lines.push({ text: line, y, size, color });
        y += lineHeight + (heading ? 3 : 0);
    });

    return (cachedLayout = { width, lines, height: y + PADDING });
};

export const getChangelogContentHeight = (width) => getLayout(width).height;

export const drawChangelog = (panelX, contentY, width, scrollY) => {
    getLayout(width).lines.forEach((line) => drawText(line.text, panelX + PADDING, contentY + line.y - scrollY, line.size, line.color));
};
