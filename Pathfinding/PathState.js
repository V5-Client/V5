const DEFAULT_STATE = {
    isWalking: false,
    splinePath: [],
    currentNodeIndex: 0,
    targetPoint: null,
    isFalling: false,
    fallingTicks: 0,
    lastRotation: { yaw: 0, pitch: 0 },
    lastTargetPoint: null,
    targetStableFrames: 0,
    jumpStartYaw: null,
    jumpStartPitch: null,
    jumpTriggered: false,
    anticipatingFall: false,
    wasInAir: false,
    lastJumpPos: null,
    ticksSinceLanding: null,
    jumpType: null,
    lastKnownPosition: null,
    lastKnownNodeIndex: 0,
    ticksWithoutProgress: 0,
    recoveryAttempts: 0,
    recoveryLockTicks: 0,
    hasRequestedRecalc: false,
};

export const movementState = { ...DEFAULT_STATE };

export let pathNodes = [];
export let keyNodes = [];

export function setPathNodes(nodes) {
    pathNodes = nodes;
}

export function setKeyNodes(nodes) {
    keyNodes = nodes;
}

export function resetMovementState() {
    Object.assign(movementState, DEFAULT_STATE);
}

export function initializeMovementState(splinePath, startIndex) {
    Object.assign(movementState, DEFAULT_STATE, {
        isWalking: true,
        splinePath,
        currentNodeIndex: startIndex,
        lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
        lastKnownNodeIndex: startIndex,
    });
}

export function setSplineForRendering(splinePath) {
    movementState.splinePath = splinePath;
}
