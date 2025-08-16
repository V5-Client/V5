// file: Toggle.js

const Color = Java.type("java.awt.Color");

const TOGGLE_BACKGROUND_COLOR_ON = new Color(0.4, 0.8, 0.4, 1);
const TOGGLE_BACKGROUND_COLOR_OFF = new Color(0.8, 0.4, 0.4, 1);
const TOGGLE_CIRCLE_COLOR = new Color(1, 1, 1, 1);

global.createToggle = (deps, option) => {
  const toggleWidth = 40;
  const toggleHeight = 20;

  const draw = (x, y) => {
    const toggleX = x + deps.panelWidth - toggleWidth - 10;
    const toggleY = y - 5;
    const toggleColor = option.value
      ? TOGGLE_BACKGROUND_COLOR_ON
      : TOGGLE_BACKGROUND_COLOR_OFF;
    const circleX = option.value ? toggleX + toggleWidth - 10 : toggleX + 10;

    deps.draw.drawRoundedRectangle({
      x: toggleX,
      y: toggleY,
      width: toggleWidth,
      height: toggleHeight,
      radius: 10,
      color: toggleColor,
    });

    deps.draw.drawCircle({
      x: circleX,
      y: toggleY + 10,
      radius: 8,
      color: TOGGLE_CIRCLE_COLOR,
    });

    Renderer.drawString(option.title, x + 10, y, 0xffffff, false);
  };

  const handleClick = (mouseX, mouseY, x, y) => {
    const toggleX = x + deps.panelWidth - toggleWidth - 10;
    const toggleY = y - 5;

    const toggleRect = {
      x: toggleX,
      y: toggleY,
      width: toggleWidth,
      height: toggleHeight,
    };

    if (deps.utils.isInside(mouseX, mouseY, toggleRect)) {
      option.value = !option.value;
      return true;
    }
    return false;
  };

  return { draw, handleClick };
};
