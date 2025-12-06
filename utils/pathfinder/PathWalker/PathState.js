export const pathState = {
    // Path stuff
    splinePath: [],
    boxPositions: [],
    currentBoxIndex: 0,
    isWalking: false,

    // Movement tracking
    lastPosition: null,
    ticksWithoutMovement: 0,
    ticksSinceLastJump: 999,
    isOnGround: true,
    wasInAir: false,

    // Rotation tracking
    lastSmoothedYaw: 0,
    lastSmoothedPitch: 0,
    rotationInitialized: false,
};

export function resetPathState() {
    pathState.splinePath = [];
    pathState.boxPositions = [];
    pathState.currentBoxIndex = 0;
    pathState.isWalking = false;
    pathState.lastPosition = null;
    pathState.ticksWithoutMovement = 0;
    pathState.ticksSinceLastJump = 999;
    pathState.isOnGround = true;
    pathState.wasInAir = false;
    pathState.lastSmoothedYaw = Player.getYaw() || 0;
    pathState.lastSmoothedPitch = Player.getPitch() || 0;
    pathState.rotationInitialized = false;
}

export function initializePathState(splinePath, boxPositions) {
    resetPathState();
    pathState.splinePath = splinePath;
    pathState.boxPositions = boxPositions;
    pathState.isWalking = true;
    pathState.currentBoxIndex = 1;
    pathState.lastSmoothedYaw = Player.getYaw() || 0;
    pathState.lastSmoothedPitch = Player.getPitch() || 0;
}

export function isPathComplete() {
    return pathState.currentBoxIndex >= pathState.boxPositions.length - 1;
}
