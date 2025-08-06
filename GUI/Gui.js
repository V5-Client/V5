const Color = Java.type("java.awt.Color");
const UIRoundedRectangle = Java.type(
  "gg.essential.elementa.components.UIRoundedRectangle"
);
const UMatrixStack = Java.type("gg.essential.universal.UMatrixStack").Compat
  .INSTANCE;

const matrix = UMatrixStack.get();

let colors = {
  Main: new Color(0.0102, 0.0106, 0.011, 0.8),
  Bar1: new Color(0.0102, 0.0106, 0.011, 1),
  Bar2: new Color(0.0102, 0.0106, 0.011, 1),
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
  UIRoundedRectangle.Companion.drawRoundedRectangle(
    matrix,
    x.Main,
    y.Main,
    x.Main + width.Main,
    y.Main + height.Main,
    radius.Main,
    colors.Main
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

register("command", () => {
  myGui.open();
}).setName("gui");
