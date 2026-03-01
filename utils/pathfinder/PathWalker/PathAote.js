import { Chat } from '../../Chat';
import { BP, SnowBlock } from '../../Constants';
import { Utils } from '../../Utils';
import { Guis } from '../../player/Inventory';
import { Keybind } from '../../player/Keybinding';
import PathConfig from '../PathConfig';
import { Jump } from './PathJumps';
import { Movement } from './PathMovement';

class PathAote {
    constructor() {
        this.cooldownTicks = 0;
        this.lastUsedPathPosition = null;
        this.MAX_AIM_YAW_ERROR = 12;
        this.FINAL_POINT_NO_AOTE_RADIUS = 18;

        this.originalSlot = -1;
        this.activeAoteSlot = -1;
        this.hasSwappedToAote = false;

        this.lastSkipReason = '';
        this.lastSkipAt = 0;
        this.lastMissingItemAt = 0;
        this.AOTE_RANGE = 14;
        this.AOTE_MIN_GAIN = this.AOTE_RANGE - 2;
        this.AOTE_STRAIGHTNESS_THRESHOLD = 25;
        this.MINIMUM_MANA_TO_USE = 100;
        this.MINIMUM_TOTAL_PATH_LENGTH = 40;
        this.STRAIGHTNESS_RELAX_IN_FLUID_DEGREES = 10;
        this.MIN_GAIN_RELAX_IN_FLUID_DISTANCE = 4;
    }

    onPathTick(rotations) {
        if (!PathConfig.WALKER_AOTE_ENABLED) return;
        if (!rotations || !rotations.boxPositions || !rotations.rotationActive || rotations.complete) return;

        const player = Player.getPlayer();
        if (!player) return;

        if (this.cooldownTicks > 0) {
            this.cooldownTicks--;
            this.debug('cooldown');
            return;
        }

        const totalPathLength = this.getTotalPathLength(rotations);
        if (totalPathLength < this.MINIMUM_TOTAL_PATH_LENGTH) {
            return this.debug(`total path too short (<${this.MINIMUM_TOTAL_PATH_LENGTH})`);
        }

        const slot = this.findAoteSlot();
        if (slot == null) {
            const now = Date.now();
            if (PathConfig.PATHFINDING_DEBUG && now - this.lastMissingItemAt > 1500) {
                this.lastMissingItemAt = now;
                Chat.messagePathfinder('§7AOTE: item missing');
            }
            return;
        }

        if (!this.ensureAoteHeld(slot)) return;

        const playerInFluid = this.isPlayerInFluid();
        const range = this.AOTE_RANGE;
        let minGain = this.AOTE_MIN_GAIN;
        let straightness = this.AOTE_STRAIGHTNESS_THRESHOLD;
        if (playerInFluid) {
            straightness += this.STRAIGHTNESS_RELAX_IN_FLUID_DEGREES;
            minGain -= this.MIN_GAIN_RELAX_IN_FLUID_DISTANCE;
        }

        if (Movement.isRecovering()) {
            return this.debug('recovery/vertical motion');
        }

        if (Math.abs(Player.getMotionY()) > 0.2 && !playerInFluid) {
            return this.debug('recovery/vertical motion');
        }

        const candidate = this.getTargetAlongPath(rotations, range);
        if (!candidate || candidate.advanceDistance < minGain) {
            return this.debug('gain too small');
        }

        if (!this.isPathStraightEnough(rotations, candidate.targetPathPosition, straightness)) {
            return this.debug('not straight');
        }

        if (this.getDistanceToFinalPoint(rotations) <= this.FINAL_POINT_NO_AOTE_RADIUS) {
            return this.debug('near final point');
        }

        if (!this.isPlayerAimingTowardPath(rotations, candidate.targetPathPosition)) {
            return this.debug('not facing path');
        }

        if (this.estimateInstantTransmissionDistance(range) < minGain) {
            return this.debug('teleport too short');
        }

        if (!this.hasEnoughMana()) return;

        Keybind.rightClick();
        Jump.suppressJump(5);
        rotations.onTeleportTriggered(candidate.targetPathPosition);
        this.cooldownTicks = PathConfig.WALKER_AOTE_COOLDOWN_TICKS;
        this.lastUsedPathPosition = rotations.currentPathPosition;

        if (PathConfig.PATHFINDING_DEBUG) {
            Chat.messagePathfinder(`§bAOTE: used at pathPos ${rotations.currentPathPosition.toFixed(1)})`);
        }
    }

    findAoteSlot() {
        const aotv = Guis.findItemInHotbar('Aspect of the Void');
        if (aotv !== -1) return aotv;

        const aote = Guis.findItemInHotbar('Aspect of the End');
        if (aote !== -1) return aote;

        return null;
    }

    ensureAoteHeld(slot) {
        if (slot == null || slot < 0 || slot > 8) return false;

        if (this.originalSlot === -1) {
            this.originalSlot = Player.getHeldItemIndex();
        }

        if (!this.hasSwappedToAote) {
            this.hasSwappedToAote = true;
            this.activeAoteSlot = slot;
            if (PathConfig.PATHFINDING_DEBUG) Chat.messagePathfinder(`§7AOTE: swapped to slot ${slot + 1}`);
        }

        if (Player.getHeldItemIndex() !== slot) {
            Guis.setItemSlot(slot);
            this.debug('waiting for slot swap');
            return false;
        }

        return true;
    }

    getTargetAlongPath(rotations, desiredDistance) {
        const path = rotations.boxPositions;
        const pathEnd = path.length - 1;
        const startT = rotations.currentPathPosition;

        if (!path || path.length < 2 || startT >= pathEnd - 0.1) return null;

        let prevPoint = rotations.getInterpolatedPoint(startT);
        let traveled = 0;
        let targetT = null;

        for (let t = startT + 1; t <= pathEnd; t += 1) {
            const point = rotations.getInterpolatedPoint(Math.min(pathEnd, t));
            traveled += this.distance(prevPoint, point);

            if (traveled >= desiredDistance) {
                targetT = Math.min(pathEnd, t);
                break;
            }

            prevPoint = point;
        }

        if (targetT === null) targetT = pathEnd;

        return {
            targetPathPosition: targetT,
            advanceDistance: traveled,
        };
    }

    hasEnoughMana() {
        const mana = Utils.getCurrentMana();
        if (mana === null) {
            this.debug('mana unavailable');
            return false;
        }

        if (mana < this.MINIMUM_MANA_TO_USE) {
            this.debug('low mana (<100)');
            return false;
        }

        return true;
    }

    isPathStraightEnough(rotations, targetPathPosition, thresholdDegrees) {
        const curvatureDegrees = (rotations.currentPathCurvature || 0) * (180 / Math.PI);
        if (curvatureDegrees > thresholdDegrees) return false;

        const startT = rotations.currentPathPosition;
        const startPoint = rotations.getInterpolatedPoint(startT);
        const endPoint = rotations.getInterpolatedPoint(targetPathPosition);
        const baseX = endPoint.x - startPoint.x;
        const baseZ = endPoint.z - startPoint.z;
        const baseLength = Math.hypot(baseX, baseZ);

        if (baseLength < 0.001) return false;

        const baseDirX = baseX / baseLength;
        const baseDirZ = baseZ / baseLength;

        let prev = startPoint;
        const step = 2;
        for (let t = startT + step; t <= targetPathPosition; t += step) {
            const curr = rotations.getInterpolatedPoint(Math.min(targetPathPosition, t));
            const dirX = curr.x - prev.x;
            const dirZ = curr.z - prev.z;
            const length = Math.hypot(dirX, dirZ);
            prev = curr;
            if (length < 0.001) continue;

            const dot = Math.max(-1, Math.min(1, (dirX / length) * baseDirX + (dirZ / length) * baseDirZ));
            const angle = Math.acos(dot) * (180 / Math.PI);
            if (angle > thresholdDegrees) return false;
        }

        return true;
    }

    isPlayerInFluid() {
        const playerMP = Player.asPlayerMP();
        return !!playerMP && (playerMP.isInWater() || playerMP.isInLava());
    }

    isPlayerAimingTowardPath(rotations, targetPathPosition) {
        const player = Player.getPlayer();
        if (!player) return false;

        const eyePos = player.getEyePos();
        const target = rotations.getInterpolatedPoint(targetPathPosition);
        if (!eyePos || !target) return false;

        const dx = target.x - eyePos.x;
        const dz = target.z - eyePos.z;
        const horiz = Math.hypot(dx, dz);
        if (horiz < 0.001) return true;

        const targetYaw = -(Math.atan2(dx, dz) * (180 / Math.PI));
        const yawError = Math.abs(this.wrapAngle(targetYaw - player.getYaw()));
        return yawError <= this.MAX_AIM_YAW_ERROR;
    }

    wrapAngle(angle) {
        let result = angle;
        while (result > 180) result -= 360;
        while (result < -180) result += 360;
        return result;
    }

    getLookDirection(player) {
        const yawRad = (-player.getYaw() * Math.PI) / 180;
        const pitchRad = (-player.getPitch() * Math.PI) / 180;
        const cosPitch = Math.cos(pitchRad);
        return {
            x: Math.sin(yawRad) * cosPitch,
            y: Math.sin(pitchRad),
            z: Math.cos(yawRad) * cosPitch,
        };
    }

    estimateInstantTransmissionDistance(maxDistance) {
        const player = Player.getPlayer();
        const world = World.getWorld();
        if (!player || !world) return 0;

        const start = player.getEyePos();
        if (!start) return 0;

        const direction = this.getLookDirection(player);
        const xDiagonalOffset = direction.x > 0 ? 1 : -1;
        const zDiagonalOffset = direction.z > 0 ? 1 : -1;
        let closeFloorY = 2147483647;

        for (let offset = 0; offset <= maxDistance; offset++) {
            const posX = start.x + direction.x * offset;
            const posY = start.y + direction.y * offset;
            const posZ = start.z + direction.z * offset;

            const checkX = Math.floor(posX);
            const checkY = Math.floor(posY);
            const checkZ = Math.floor(posZ);

            if (!this.canTeleportThrough(checkX, checkY, checkZ)) {
                if (offset === 0) return 0;
                return Math.max(0, offset - 1);
            }

            if (!this.canTeleportThrough(checkX, checkY + 1, checkZ)) {
                if (offset === 0) {
                    const justAheadY = start.y + direction.y * 0.2;
                    if (justAheadY - Math.floor(justAheadY) <= 0.495) continue;
                    return 0;
                }
                return Math.max(0, offset - 1);
            }

            if (offset !== 0) {
                const prevX = Math.floor(start.x + direction.x * (offset - 1));
                const prevY = Math.floor(start.y + direction.y * (offset - 1));
                const prevZ = Math.floor(start.z + direction.z * (offset - 1));

                if (direction.x < 0 && this.isBlockFloor(checkX + 1, checkY, checkZ) && this.isBlockFloor(prevX, prevY, prevZ + zDiagonalOffset)) {
                    return Math.max(0, offset - 1);
                }

                if (
                    direction.z < 0 &&
                    direction.x < 0 &&
                    this.isBlockFloor(checkX, checkY, checkZ + 1) &&
                    this.isBlockFloor(prevX + xDiagonalOffset, prevY, prevZ)
                ) {
                    return Math.max(0, offset - 1);
                }
            }

            const nearFloor =
                this.isBlockFloor(checkX, checkY - 1, checkZ) ||
                (this.isBlockFloor(checkX + xDiagonalOffset, checkY - 1, checkZ) && this.isBlockFloor(checkX, checkY - 1, checkZ + zDiagonalOffset));

            if (nearFloor && posY - Math.floor(posY) < 0.31) {
                closeFloorY = checkY - 1;
            }

            if (closeFloorY === checkY) {
                return Math.max(0, offset - 1);
            }
        }

        return maxDistance;
    }

    canTeleportThrough(x, y, z) {
        const world = World.getWorld();
        if (!world) return false;

        const pos = new BP(x, y, z);
        const state = world.getBlockState(pos);
        if (!state) return false;

        if (state.isAir()) return true;

        const shape = state.getCollisionShape(world, pos);
        if (shape && shape.isEmpty()) return true;

        const block = World.getBlockAt(x, y, z);
        if (!block || !block.type) return false;

        const name = block.type.getRegistryName().toLowerCase();
        if (name.includes('carpet') || name.includes('flower_pot') || name.includes('web')) return true;

        if (name === 'minecraft:snow') {
            const layers = this.getSnowLayers(block);
            return layers > 0 && layers <= 3;
        }

        return false;
    }

    isBlockFloor(x, y, z) {
        const world = World.getWorld();
        if (!world) return false;

        const pos = new BP(x, y, z);
        const state = world.getBlockState(pos);
        if (!state) return false;

        const shape = state.getCollisionShape(world, pos);
        if (!shape || shape.isEmpty()) return false;

        const block = World.getBlockAt(x, y, z);
        if (!block || !block.type) return false;
        const name = block.type.getRegistryName().toLowerCase();
        if (name.includes('mud')) return true;
        if (this.canTeleportThrough(x, y, z)) return false;

        return true;
    }

    getSnowLayers(block) {
        if (!block || block.type.getRegistryName() !== 'minecraft:snow') return 0;
        return block.getState().get(SnowBlock.LAYERS);
    }

    getDistanceToFinalPoint(rotations) {
        const finalPoint = rotations?.boxPositions?.[rotations.boxPositions.length - 1];
        if (!finalPoint) return Number.MAX_VALUE;
        const dx = Player.getX() - finalPoint.x;
        const dy = Player.getY() - finalPoint.y;
        const dz = Player.getZ() - finalPoint.z;
        return Math.hypot(dx, dy, dz);
    }

    getTotalPathLength(rotations) {
        const path = rotations?.boxPositions;
        if (!path || path.length < 2) return 0;

        let distance = 0;
        for (let i = 1; i < path.length; i += 1) {
            distance += this.distance(path[i - 1], path[i]);
        }

        return distance;
    }

    distance(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        return Math.hypot(dx, dy, dz);
    }

    debug(reason) {
        if (!PathConfig.PATHFINDING_DEBUG) return;
        if (reason === this.lastSkipReason) return;
        this.lastSkipReason = reason;
        Chat.messagePathfinder(`§7AOTE: skipped (${reason})`);
    }

    stop(restoreSlot = true) {
        if (restoreSlot && this.originalSlot >= 0 && this.originalSlot <= 8) {
            Guis.setItemSlot(this.originalSlot);
            if (PathConfig.PATHFINDING_DEBUG) {
                Chat.messagePathfinder(`§7AOTE: restored original slot (${this.originalSlot + 1})`);
            }
        }

        this.cooldownTicks = 0;
        this.lastUsedPathPosition = null;
        this.lastSkipReason = '';
        this.lastSkipAt = 0;
        this.lastMissingItemAt = 0;

        if (restoreSlot) {
            this.originalSlot = -1;
            this.activeAoteSlot = -1;
            this.hasSwappedToAote = false;
        }
    }
}

export const Aote = new PathAote();
