export const movementState = {
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
    });
}

export function initializeMovementState(splinePath, startIndex) {
    Object.assign(movementState, {
        isWalking: true,
        splinePath: splinePath,
        currentNodeIndex: startIndex,
        fallingTicks: 0,
        lastRotation: { yaw: Player.getYaw(), pitch: Player.getPitch() },
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
        lastKnownNodeIndex: startIndex,
        ticksWithoutProgress: 0,
    });
}

export function setSplineForRendering(splinePath) {
    movementState.splinePath = splinePath;
}
