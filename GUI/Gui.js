const Color = Java.type("java.awt.Color");
const UIRoundedRectangle = Java.type(
  "gg.essential.elementa.components.UIRoundedRectangle"
);
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat
  .INSTANCE;

const matrix = UMatrixStack.get();

let colors = {
  Main: new Color(0.0102, 0.0106, 0.011, 0.4),
  Bar1: new Color(0.0102, 0.0106, 0.011, 0.9),
  Bar2: new Color(0.0102, 0.0106, 0.011, 0.9),
};
let x = {
  Main: Renderer.screen.getWidth() / 2 - 300,
  Bar1: Renderer.screen.getWidth() / 2 - 285,
  Bar2: Renderer.screen.getWidth() / 2 - 205,
};
let y = {
  Main: Renderer.screen.getHeight() / 2 - 200,
  Bar1: Renderer.screen.getHeight() / 2 - 190,
  Bar2: Renderer.screen.getHeight() / 2 - 190,
};
let width = {
  Main: 600,
  Bar1: 50,
  Bar2: 490,
};
let height = {
  Main: 400,
  Bar1: 375,
  Bar2: 375,
};
let radius = {
  Main: 10,
  Bar1: 10,
  Bar2: 10,
};

const myGui = new Gui();

myGui.registerDraw(() => {
  DrawRects();
  Renderer.drawString("Hello World!", 10, 10);
});

const DrawRects = () => {
  drawDropShadow(
    matrix,
    50,
    50,
    50,
    200,
    100,
    0.8,
    8,
    new Color(0.1, 0.5, 0.9, 1)
  );

  UIRoundedRectangle.Companion.drawRoundedRectangle(
    matrix,
    x.Bar1,
    y.Bar1,
    x.Bar1 + width.Bar1,
    y.Bar1 + height.Bar1,
    radius.Bar1,
    colors.Bar1
  );

  UIRoundedRectangle.Companion.drawRoundedRectangle(
    matrix,
    x.Bar2,
    y.Bar2,
    x.Bar2 + width.Bar2,
    y.Bar2 + height.Bar2,
    radius.Bar2,
    colors.Bar2
  );
};

function drawDropShadow(
  matrix,
  loops,
  x,
  y,
  width,
  height,
  opacity,
  edgeRadius,
  baseColor
) {
  let r = baseColor.getRed() / 255;
  let g = baseColor.getGreen() / 255;
  let b = baseColor.getBlue() / 255;

  for (let margin = 0; margin <= loops / 2; margin += 0.5) {
    let alpha = Math.min(0.2, Math.max(0.007, (opacity - margin) * 1.3));

    UIRoundedRectangle.Companion.drawRoundedRectangle(
      matrix,
      x - margin / 2,
      y - margin / 2,
      x + width + margin / 2,
      y + height + margin / 2,
      edgeRadius,
      new Color(r, g, b, alpha)
    );
  }
}

register("command", () => {
  myGui.open();
}).setName("gui");
