export const movementState = {
    isWalking: false,
    splinePath: [],
    currentNodeIndex: 0,
    targetPoint: null,
    isFalling: false,
    lastRotation: { yaw: 0, pitch: 0 },
    lastTargetPoint: null,
    targetStableFrames: 0,
};

export let pathNodes = [];
export let keyNodes = [];

export function setPathNodes(nodes) {
    pathNodes = nodes;
}

export function setKeyNodes(nodes) {
    keyNodes = nodes;
}

export function resetMovementState() {
    Object.assign(movementState, {
        isWalking: false,
        splinePath: [], // Clear spline path
        currentNodeIndex: 0,
        targetPoint: null,
        isFalling: false,
        lastRotation: { yaw: 0, pitch: 0 },
        lastTargetPoint: null,
        targetStableFrames: 0,
    });
}

export function initializeMovementState(splinePath, startIndex) {
    Object.assign(movementState, {
        isWalking: true,
        splinePath: splinePath,
        currentNodeIndex: startIndex,
        lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
        lastTargetPoint: null,
        targetStableFrames: 0,
    });
}

export function setSplineForRendering(splinePath) {
    movementState.splinePath = splinePath;
}
