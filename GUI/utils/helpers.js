export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const isInside = (mouseX, mouseY, rect) => mouseX >= rect.x && mouseX <= rect.x + rect.width && mouseY >= rect.y && mouseY <= rect.y + rect.height;

export const colorWithAlpha = (baseColor, alpha) =>
    new Color(baseColor.getRed() / 255, baseColor.getGreen() / 255, baseColor.getBlue() / 255, (baseColor.getAlpha() / 255) * alpha);
