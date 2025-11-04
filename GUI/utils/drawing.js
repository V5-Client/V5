import { UIRoundedRectangle, Matrix } from '../../Utility/Constants';

export const drawRoundedRectangle = ({ x, y, width, height, radius, color }) => {
    UIRoundedRectangle.Companion.drawRoundedRectangle(Matrix, x, y, x + width, y + height, radius, color);
};

export const drawRoundedRectangleWithBorder = (r) => {
    if (r.borderWidth && r.borderWidth > 0) {
        const bw = r.borderWidth;
        const innerWidth = Math.max(0, r.width - bw * 2);
        const innerHeight = Math.max(0, r.height - bw * 2);
        const innerRadius = Math.max(0, r.radius - bw);

        if (r.borderColor && bw > 0) {
            drawRoundedRectangle({
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                radius: r.radius,
                color: r.borderColor,
            });
        }

        if (innerWidth > 0 && innerHeight > 0) {
            drawRoundedRectangle({
                x: r.x + bw,
                y: r.y + bw,
                width: innerWidth,
                height: innerHeight,
                radius: innerRadius,
                color: r.color,
            });
        }
    } else {
        drawRoundedRectangle(r);
    }
};
