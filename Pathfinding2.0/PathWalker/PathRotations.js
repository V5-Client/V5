import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';
import { MathUtils } from '../../Utility/Math';
import { Rotations } from '../../Utility/Rotations';
import { renderSplineBoxes } from '../PathDebug';

const MIN_SPEED_CONSTANT = 20;
const MAX_SPEED_CONSTANT = 50;
const ANGLE_SCALING_FACTOR = 3.5;

const GENERAL_PITCH_DAMPENING = 0.4;
const MAX_UPWARD_PITCH_GRADE = -15.0;
const MAX_DOWNWARD_PITCH_GRADE = 20.0;

const LOOK_AHEAD_DISTANCE = 3;

let currentBoxIndex = 1;

const NODE_DROP_THRESHOLD_Y = 9;
const LOOK_AHEAD_NODE_INDEX_OFFSET = 10;

const DROP_PITCH_FACTOR = 1.0;
const MAX_PITCH_REDUCTION = 10.0;
const MAX_PITCH_FOR_DROP = 30;

const ADVANCE_DISTANCE = 1;

const MAX_ALLOWED_PITCH_DOWN = 89.9;
const MAX_ALLOWED_PITCH_UP = -89.9;

const BOX_RESET_SEARCH_RANGE = 20;

let lastDropCheckNodeIndex = 0;

function calculateRotationSpeed(targetPoint) {
    const { yaw: relYaw, pitch: relPitch } =
        MathUtils.calculateAngles(targetPoint);

    const totalAngleDifference = Math.abs(relYaw) + Math.abs(relPitch);

    const range = MAX_SPEED_CONSTANT - MIN_SPEED_CONSTANT;

    let speedConstant =
        MIN_SPEED_CONSTANT +
        range *
            Math.exp((-ANGLE_SCALING_FACTOR * totalAngleDifference) / 180.0);

    speedConstant = Math.max(
        MIN_SPEED_CONSTANT,
        Math.min(MAX_SPEED_CONSTANT, speedConstant)
    );

    return speedConstant;
}

export function pathRotations(splineData, dropCheckNodes) {
    const boxPositions = renderSplineBoxes(splineData, 1);
    const playerEyes = Player.getPlayer().getEyePos();

    if (boxPositions.length === 0) {
        currentBoxIndex = -1;
        return;
    }

    let closestBoxDistanceSq = Infinity;
    let newCurrentBoxIndex = currentBoxIndex;
    const startIndex = Math.max(0, currentBoxIndex - BOX_RESET_SEARCH_RANGE);
    const endIndex = Math.min(
        boxPositions.length,
        currentBoxIndex + BOX_RESET_SEARCH_RANGE
    );

    for (let i = startIndex; i < endIndex; i++) {
        const box = boxPositions[i];
        const dx = playerEyes.x - (box.x + 0.5);
        const dz = playerEyes.z - (box.z + 0.5);
        const horizontalDistanceSq = dx * dx + dz * dz;

        if (horizontalDistanceSq < closestBoxDistanceSq) {
            closestBoxDistanceSq = horizontalDistanceSq;
            newCurrentBoxIndex = i;
        }
    }

    if (newCurrentBoxIndex >= currentBoxIndex - 5) {
        currentBoxIndex = newCurrentBoxIndex;
    }

    if (currentBoxIndex < 0 || currentBoxIndex >= boxPositions.length) {
        currentBoxIndex = -1;
        return;
    }

    let dropCheckNode = null;
    let closestNodeDistanceSq = Infinity;
    let newDropCheckNodeIndex = lastDropCheckNodeIndex;

    for (let i = lastDropCheckNodeIndex; i < dropCheckNodes.length; i++) {
        const node = dropCheckNodes[i];

        if (node.y > Player.y) {
            continue;
        }

        const dx = playerEyes.x - node.x;
        const dz = playerEyes.z - node.z;
        const horizontalDistanceSq = dx * dx + dz * dz;

        if (horizontalDistanceSq < closestNodeDistanceSq) {
            closestNodeDistanceSq = horizontalDistanceSq;
            newDropCheckNodeIndex = i;
        }
    }

    lastDropCheckNodeIndex = newDropCheckNodeIndex;
    const targetNodeIndex = Math.min(
        lastDropCheckNodeIndex + LOOK_AHEAD_NODE_INDEX_OFFSET,
        dropCheckNodes.length - 1
    );

    if (dropCheckNodes.length > targetNodeIndex) {
        dropCheckNode = dropCheckNodes[targetNodeIndex];
    }

    let maxDropMagnitude = 0;
    let isDropAhead = false;

    if (dropCheckNode) {
        const nodeDrop = playerEyes.y - dropCheckNode.y;

        if (nodeDrop > NODE_DROP_THRESHOLD_Y) {
            isDropAhead = true;
            ChatLib.chat(`CRITICAL Node Drop Detected! Magnitude: ${nodeDrop}`);
            maxDropMagnitude = nodeDrop;
        }
    }

    if (dropCheckNode) {
        ChatLib.chat(
            `Drop Check Node (Index ${targetNodeIndex}) at X:${dropCheckNode.x}, Y:${dropCheckNode.y}, Z:${dropCheckNode.z}`
        );
        RenderUtils.drawBox(
            new Vec3d(dropCheckNode.x, dropCheckNode.y, dropCheckNode.z),
            [255, 0, 0, 70]
        );
    }

    const targetPathIndex = Math.min(
        currentBoxIndex + LOOK_AHEAD_DISTANCE,
        boxPositions.length - 1
    );

    const targetPoint = boxPositions[targetPathIndex];
    if (!targetPoint) return;

    const lookAheadBoxCenter = new Vec3d(
        targetPoint.x + 0.5,
        targetPoint.y + 0.5,
        targetPoint.z + 0.5
    );

    let rotationSpeedConstant = calculateRotationSpeed(lookAheadBoxCenter);
    ChatLib.chat(`Dynamic Speed Constant: ${rotationSpeedConstant.toFixed(2)}`);

    let finalRotationTargetPoint = lookAheadBoxCenter;

    if (isDropAhead && dropCheckNode) {
        finalRotationTargetPoint = new Vec3d(
            dropCheckNode.x,
            lookAheadBoxCenter.y,
            dropCheckNode.z
        );
        ChatLib.chat('DROP: Yaw directed towards Red Node.');
    } else {
        ChatLib.chat('NO DROP: Yaw directed towards Green Node.');
    }

    const { pitch, yaw } = MathUtils.calculateAbsoluteAngles(
        finalRotationTargetPoint
    );

    let finalPitch = pitch;

    finalPitch *= GENERAL_PITCH_DAMPENING;
    finalPitch = Math.max(finalPitch, MAX_UPWARD_PITCH_GRADE);
    finalPitch = Math.min(finalPitch, MAX_DOWNWARD_PITCH_GRADE);

    if (maxDropMagnitude > 0) {
        let pitchIncrease = maxDropMagnitude * DROP_PITCH_FACTOR;

        pitchIncrease = Math.min(pitchIncrease, MAX_PITCH_REDUCTION);

        finalPitch += pitchIncrease;

        finalPitch = Math.min(finalPitch, MAX_PITCH_FOR_DROP);

        finalPitch = Math.min(finalPitch, MAX_ALLOWED_PITCH_DOWN);
        finalPitch = Math.max(finalPitch, MAX_ALLOWED_PITCH_UP);
    } else {
        finalPitch = Math.min(finalPitch, MAX_ALLOWED_PITCH_DOWN);
        finalPitch = Math.max(finalPitch, MAX_ALLOWED_PITCH_UP);
    }

    if (isDropAhead || !Player.getPlayer().isOnGround()) {
        rotationSpeedConstant = Math.min(
            rotationSpeedConstant,
            MIN_SPEED_CONSTANT
        );
        ChatLib.chat('Forcing fastest rotation speed due to drop/air.');
    }

    const dynamicSpeed = rotationSpeedConstant;

    Rotations.rotateToAngles(yaw, finalPitch, false, dynamicSpeed);

    const horizontalDistanceToNextPoint = Math.hypot(
        playerEyes.x - (boxPositions[currentBoxIndex].x + 0.5),
        playerEyes.z - (boxPositions[currentBoxIndex].z + 0.5)
    );

    if (horizontalDistanceToNextPoint < ADVANCE_DISTANCE) {
        currentBoxIndex++;
    }
}
