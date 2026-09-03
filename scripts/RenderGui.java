import io.github.humbleui.skija.*;
import io.github.humbleui.skija.svg.SVGDOM;
import io.github.humbleui.skija.svg.SVGLengthContext;
import io.github.humbleui.types.RRect;
import io.github.humbleui.types.Rect;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@SuppressWarnings("deprecation")
class RenderGui {
    static Typeface typeface;
    static final Map<Float, Font> fonts = new HashMap<>();
    static Canvas canvas;
    static float alpha = 1;

    public static void main(String[] args) throws Exception {
        if (args[0].equals("measure")) measure(Path.of(args[1]), Path.of(args[2]), Path.of(args[3]));
        else render(Path.of(args[1]), Path.of(args[2]));
    }

    static void measure(Path loader, Path requests, Path output) throws Exception {
        loadFont(loader.resolve("src/main/resources/assets/v5/font.otf"));
        var lines = new StringBuilder();
        for (var request : Files.readAllLines(requests)) {
            if (request.isBlank()) continue;
            var fields = request.split("\\t");
            var size = Float.parseFloat(fields[0]);
            var value = decode(fields[1]);
            try (var line = TextLine.make(value, font(size))) {
                lines.append(fields[0]).append('\t').append(fields[1]).append('\t').append(line.getWidth()).append('\n');
            }
        }
        Files.writeString(output, lines);
        closeFonts();
    }

    static void render(Path commands, Path output) throws Exception {
        var loader = output.getParent().getParent().resolveSibling("V5Loader");
        loadFont(loader.resolve("src/main/resources/assets/v5/font.otf"));
        Files.createDirectories(output.getParent());
        try (var surface = Surface.makeRasterN32Premul(960, 540)) {
            canvas = surface.getCanvas();
            canvas.clear(0);
            canvas.scale(2, 2);
            for (var line : Files.readAllLines(commands)) replay(line.split("\\t"));
            try (var image = surface.makeImageSnapshot(); var png = image.encodeToData(EncodedImageFormat.PNG)) {
                Files.write(output, png.getBytes());
            }
        }
        closeFonts();
        if (Files.size(output) < 1_000) throw new IllegalStateException("Incomplete GUI render");
        System.out.println("Rendered " + output);
    }

    static void replay(String[] value) throws Exception {
        switch (value[0]) {
            case "save" -> canvas.save();
            case "restore" -> canvas.restore();
            case "translate" -> canvas.translate(f(value[1]), f(value[2]));
            case "scale" -> canvas.scale(f(value[1]), f(value[2]));
            case "rotate" -> canvas.rotate(f(value[1]));
            case "scissor" -> { canvas.save(); canvas.clipRect(Rect.makeXYWH(f(value[1]), f(value[2]), f(value[3]), f(value[4])), true); }
            case "resetScissor" -> canvas.restore();
            case "alpha" -> alpha = f(value[1]);
            case "rect" -> rect(f(value[1]), f(value[2]), f(value[3]), f(value[4]), i(value[5]));
            case "round" -> round(f(value[1]), f(value[2]), f(value[3]), f(value[4]), f(value[5]), i(value[6]));
            case "varied" -> varied(value);
            case "text" -> text(value);
            case "image" -> image(value);
            case "shadow" -> shadow(value);
        }
    }

    static void rect(float x, float y, float width, float height, int color) {
        try (var paint = paint(color)) { canvas.drawRect(Rect.makeXYWH(x, y, width, height), paint); }
    }

    static void round(float x, float y, float width, float height, float radius, int color) {
        try (var paint = paint(color)) { canvas.drawRRect(RRect.makeXYWH(x, y, width, height, Math.max(0, radius)), paint); }
    }

    static void varied(String[] v) {
        var radii = new float[] { f(v[6]), f(v[6]), f(v[7]), f(v[7]), f(v[8]), f(v[8]), f(v[9]), f(v[9]) };
        try (var paint = paint(i(v[5]))) { canvas.drawRRect(RRect.makeComplexXYWH(f(v[1]), f(v[2]), f(v[3]), f(v[4]), radii), paint); }
    }

    static void text(String[] v) {
        var size = f(v[4]);
        var x = f(v[2]);
        var y = f(v[3]);
        var align = Integer.parseInt(v[6]);
        var font = font(size);
        try (var line = TextLine.make(decode(v[1]), font); var paint = paint(i(v[5]))) {
            var metrics = font.getMetrics();
            var baseline = (align & 32) != 0 ? y - metrics.getDescent() : (align & 16) != 0 ? y - (metrics.getAscent() + metrics.getDescent()) / 2 : (align & 8) != 0 ? y - metrics.getAscent() : y;
            var drawX = (align & 4) != 0 ? x - line.getWidth() : (align & 2) != 0 ? x - line.getWidth() / 2 : x;
            canvas.drawTextLine(line, drawX, baseline, paint);
        }
    }

    static void image(String[] v) throws Exception {
        var path = Path.of(decode(v[1]));
        try (var data = Data.makeFromBytes(Files.readAllBytes(path)); var dom = new SVGDOM(data)) {
            var intrinsic = dom.getRoot().getIntrinsicSize(new SVGLengthContext(256, 256, 96));
            var width = Math.max(1, Math.round(intrinsic.getX()));
            var height = Math.max(1, Math.round(intrinsic.getY()));
            try (var surface = Surface.makeRasterN32Premul(width, height)) {
                surface.getCanvas().clear(0);
                dom.setContainerSize(width, height);
                dom.render(surface.getCanvas());
                try (var image = surface.makeImageSnapshot(); var paint = new Paint().setAntiAlias(true).setAlphaf(alpha * f(v[7]))) {
                    var destination = Rect.makeXYWH(f(v[2]), f(v[3]), f(v[4]), f(v[5]));
                    if (f(v[6]) > 0) { canvas.save(); canvas.clipRRect(RRect.makeXYWH(destination.getLeft(), destination.getTop(), destination.getWidth(), destination.getHeight(), f(v[6])), true); }
                    canvas.drawImageRect(image, Rect.makeWH(width, height), destination, SamplingMode.LINEAR, paint, true);
                    if (f(v[6]) > 0) canvas.restore();
                }
            }
        }
    }

    static void shadow(String[] v) {
        try (var filter = MaskFilter.makeBlur(FilterBlurMode.NORMAL, f(v[6]) / 2); var paint = paint(i(v[8])).setMaskFilter(filter)) {
            var spread = f(v[7]);
            canvas.drawRRect(RRect.makeXYWH(f(v[1]) - spread, f(v[2]) - spread, f(v[3]) + spread * 2, f(v[4]) + spread * 2, f(v[5]) + spread), paint);
        }
    }

    static Paint paint(int color) {
        var sourceAlpha = (color >>> 24) & 255;
        return new Paint().setAntiAlias(true).setColor((color & 0xffffff) | (Math.round(sourceAlpha * alpha) << 24));
    }

    static void loadFont(Path path) throws Exception {
        try (var data = Data.makeFromBytes(Files.readAllBytes(path))) { typeface = FontMgr.getDefault().makeFromData(data); }
        if (typeface == null) throw new IllegalStateException("Unable to load V5 font");
    }

    static Font font(float size) {
        return fonts.computeIfAbsent(size, value -> new Font(typeface, value).setSubpixel(true).setEdging(FontEdging.SUBPIXEL_ANTI_ALIAS).setHinting(FontHinting.SLIGHT));
    }

    static void closeFonts() { fonts.values().forEach(Font::close); fonts.clear(); typeface.close(); }
    static String decode(String value) { return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8); }
    static float f(String value) { return Float.parseFloat(value); }
    static int i(String value) { return (int) Long.parseLong(value); }
}
