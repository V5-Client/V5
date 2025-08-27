export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const isInside = (mouseX, mouseY, rect) =>
  mouseX >= rect.x &&
  mouseX <= rect.x + rect.width &&
  mouseY >= rect.y &&
  mouseY <= rect.y + rect.height;

export const createCircularImage = (originalImage) => {
  if (!originalImage) return null; // Get the original image's BufferedImage
  const BufferedImage = java.awt.image.BufferedImage
  const originalBuffered = originalImage.getImage();
  const width = originalBuffered.getWidth();
  const height = originalBuffered.getHeight();
  const size = Math.min(width, height); // Create a new BufferedImage with transparency
  const circularBuffered = new BufferedImage(
    size,
    size,
    BufferedImage.TYPE_INT_ARGB
  );
  const graphics = circularBuffered.createGraphics(); // Enable antialiasing for smooth edges
  const RenderingHints = java.awt.RenderingHints
  graphics.setRenderingHint(
    RenderingHints.KEY_ANTIALIASING,
    RenderingHints.VALUE_ANTIALIAS_ON
  );
  graphics.setRenderingHint(
    RenderingHints.KEY_RENDERING,
    RenderingHints.VALUE_RENDER_QUALITY
  );
  graphics.setRenderingHint(
    RenderingHints.KEY_INTERPOLATION,
    RenderingHints.VALUE_INTERPOLATION_BILINEAR
  ); // Create circular clip
  const Ellipse2D = java.awt.geom.Ellipse2D$Float
  const circle = new Ellipse2D(0, 0, size, size);
  graphics.setClip(circle); // Draw the image centered in the circle
  const xOffset = (width - size) / 2;
  const yOffset = (height - size) / 2;
  graphics.drawImage(originalBuffered, -xOffset, -yOffset, width, height, null);
  graphics.dispose(); // Convert back to ChatTriggers Image
  return new Image(circularBuffered);
};
