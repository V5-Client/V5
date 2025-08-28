const File = java.io.File;
const BufferedInputStream = java.io.BufferedInputStream;
const FileOutputStream = java.io.FileOutputStream;
const URL = java.net.URL;

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const isInside = (mouseX, mouseY, rect) =>
  mouseX >= rect.x &&
  mouseX <= rect.x + rect.width &&
  mouseY >= rect.y &&
  mouseY <= rect.y + rect.height;

export const createCircularImage = (originalImage) => {
  if (!originalImage) return null; // Get the original image's BufferedImage
  const BufferedImage = java.awt.image.BufferedImage;
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
  const RenderingHints = java.awt.RenderingHints;
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
  const Ellipse2D = java.awt.geom.Ellipse2D$Float;
  const circle = new Ellipse2D(0, 0, size, size);
  graphics.setClip(circle); // Draw the image centered in the circle
  const xOffset = (width - size) / 2;
  const yOffset = (height - size) / 2;
  graphics.drawImage(originalBuffered, -xOffset, -yOffset, width, height, null);
  graphics.dispose(); // Convert back to ChatTriggers Image
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
    let response = "";
    while ((inputLine = reader.readLine()) != null) {
      response += inputLine + "\n";
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
  } catch (e) {}
}
