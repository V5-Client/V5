import { Spline } from '../PathSpline';

class PathRotations {
    constructor() {
        this.boxPositions = [];
        this.currentBoxIndex = 0;
        this.drawPoints = false;
    }

    PathRotations(path) {
        this.boxPositions = Spline.CreateLookPoints(path, 1.5, this.drawPoints);
    }

    DrawLookPoints(v) {
        this.drawPoints = v;
    }
}

export const Rotations = new PathRotations();
