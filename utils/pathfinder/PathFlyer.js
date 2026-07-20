import { MathUtils } from '../Math';
import { PathExecutor } from './PathExecutor';
import { PathRotationsUtility } from './PathWalker/PathRotationsUtility';

class SimulationPathFlyer {
    constructor() {
        this.HORIZONTAL_DRAG = 0.91;
        this.VERTICAL_DRAG = 0.6;
        this.VERTICAL_ACCELERATION = 3;
        this.VERTICAL_START_ERROR = 0.65;
        this.VERTICAL_STOP_ERROR = 0.15;
        this.VERTICAL_COAST_TICKS = 2;
        this.ACTION_HYSTERESIS = 4;
        this.MIN_ACTION_TICKS = 3;
        this.FLIGHT_START_TICKS = 6;
        this.STALL_MS = 6000;
        this.EYE_HEIGHT = 1.62;

        this.horizontalActions = [
            { forward: 0, strafe: 0 },
            { forward: 1, strafe: 0 },
            { forward: -1, strafe: 0 },
            { forward: 0, strafe: -1 },
            { forward: 0, strafe: 1 },
            { forward: 1, strafe: -1 },
            { forward: 1, strafe: 1 },
            { forward: -1, strafe: -1 },
            { forward: -1, strafe: 1 },
        ];

        this.reset();
        PathExecutor.onTick(() => this.tick());
        PathExecutor.onStep(() => this.updateRotation());
    }

    begin(nodes) {
        const path = [];
        for (const node of nodes || []) {
            const point = {
                x: Number(node.x ?? node[0]) + 0.5,
                y: Number(node.y ?? node[1]),
                z: Number(node.z ?? node[2]) + 0.5,
                distance: 0,
            };
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) continue;

            const previous = path[path.length - 1];
            if (previous) {
                const distance = Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z);
                if (distance < 0.05) continue;
                point.distance = previous.distance + distance;
            }
            path.push(point);
        }

        if (!path.length || !Player.getPlayer()) return false;

        this.releaseKeys();
        this.path = path;
        this.totalDistance = path[path.length - 1].distance;
        this.segment = 0;
        this.progressDistance = 0;
        this.bestProgressDistance = 0;
        this.lastProgressAt = Date.now();
        this.lastAction = null;
        this.actionTicks = 0;
        this.flightStartTicks = 0;
        this.complete = false;
        this.isActive = true;
        this.rotationActive = true;
        this.currentYaw = MathUtils.wrapTo180(Player.getYaw());
        this.currentPitch = Player.getPitch();
        this.targetYaw = this.currentYaw;
        this.targetPitch = this.currentPitch;
        this.lastRotationAt = Date.now();
        this.verticalTargetY = null;
        this.verticalCommand = 0;
        this.verticalCoastTicks = 0;
        this.groundRecovering = false;
        this.updatePathState();
        return true;
    }

    tick() {
        if (!this.isActive) return;

        const player = Player.getPlayer();
        if (!player) {
            this.stop(false);
            return;
        }

        if (Date.now() - this.lastProgressAt > this.STALL_MS) {
            this.stop(false);
            return;
        }

        this.updatePathState();
        if (this.hasArrived()) {
            this.stop(true);
            return;
        }

        const abilities = player.getAbilities();
        const onGround = player.onGround();
        if (onGround && !this.groundRecovering) {
            this.groundRecovering = true;
            this.flightStartTicks = 0;
            this.verticalCommand = 0;
            this.verticalCoastTicks = 0;
            this.lastAction = null;
            this.actionTicks = 0;
            this.lastProgressAt = Date.now();
        }

        if (onGround || (!abilities.flying && this.flightStartTicks < this.FLIGHT_START_TICKS)) {
            ['w', 'a', 's', 'd', 'shift', 'sprint'].forEach((key) => Client.setKey(key, false));
            if (this.flightStartTicks < this.FLIGHT_START_TICKS) {
                Client.setKey('space', !Client.isKeyDown('space'));
                this.flightStartTicks++;
            } else {
                Client.setKey('space', true);
            }
            return;
        }
        this.flightStartTicks = this.FLIGHT_START_TICKS;
        this.groundRecovering = false;

        const action = this.chooseAction(player, abilities);

        this.applyAction(action);
        this.actionTicks = this.sameAction(action, this.lastAction) ? this.actionTicks + 1 : 1;
        this.lastAction = action;
    }

    updatePathState() {
        if (!this.path.length || !Player.getPlayer()) return;

        const position = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        const projection = this.project(position, this.segment);
        this.segment = projection.segment;
        this.progressDistance = Math.max(this.progressDistance, projection.distance);

        if (this.progressDistance > this.bestProgressDistance + 0.4) {
            this.bestProgressDistance = this.progressDistance;
            this.lastProgressAt = Date.now();
        }

        const speedXZ = Math.hypot(Player.getMotionX(), Player.getMotionZ());
        this.remainingDistance = Math.max(0, this.totalDistance - this.progressDistance);
        const movementLookahead = Math.min(this.remainingDistance, Math.max(3, Math.min(10, 3 + speedXZ * 7)));
        const rotationLookahead = Math.min(this.remainingDistance, Math.max(5, Math.min(14, 5 + speedXZ * 8)));
        this.movementTarget = this.pointWithHorizontalLead(position, this.progressDistance + movementLookahead, 2);
        const lookTarget = this.pointWithHorizontalLead(position, this.progressDistance + rotationLookahead, 4);
        if (this.verticalTargetY === null) {
            this.verticalTargetY = this.movementTarget.y;
        } else {
            const targetStep = Math.max(-0.35, Math.min(0.35, (this.movementTarget.y - this.verticalTargetY) * 0.35));
            this.verticalTargetY += targetStep;
        }

        const near = this.pointAtDistance(Math.min(this.totalDistance, this.progressDistance + 1));
        const far = this.pointAtDistance(Math.min(this.totalDistance, this.progressDistance + 7));
        this.turnAngle = this.angleBetween({ x: near.x - projection.point.x, z: near.z - projection.point.z }, { x: far.x - near.x, z: far.z - near.z });

        const angles = MathUtils.calculateAbsoluteAngles({ x: lookTarget.x, y: lookTarget.y + this.EYE_HEIGHT, z: lookTarget.z });
        this.targetYaw = angles.yaw;
        this.targetPitch = angles.pitch;
    }

    chooseAction(player, abilities) {
        const origin = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        const initial = {
            x: origin.x,
            y: origin.y,
            z: origin.z,
            vx: Player.getMotionX(),
            vy: Player.getMotionY(),
            vz: Player.getMotionZ(),
            yaw: Player.getYaw(),
            sprinting: !!player.isSprinting?.(),
        };
        const flyingSpeed = Number(abilities.getFlyingSpeed?.()) || 0.05;
        const sprint = this.remainingDistance > 10 && this.turnAngle < 25;
        const horizontal = this.rankHorizontalActions(initial, flyingSpeed, sprint);
        const vertical = this.rankVerticalActions(initial);
        const candidates = [];

        for (const h of horizontal) {
            for (const v of vertical) {
                candidates.push({
                    action: { forward: h.action.forward, strafe: h.action.strafe, vertical: v.vertical, sprint: h.action.sprint },
                    score: h.score + v.score,
                });
            }
        }
        candidates.sort((a, b) => a.score - b.score);
        this.preferCurrentAction(candidates);
        return candidates[0].action;
    }

    rankHorizontalActions(initial, flyingSpeed, sprint) {
        const ranked = [];
        const stopped = Math.hypot(initial.vx, initial.vz) < 0.03;
        const needsHorizontalProgress = Math.hypot(this.movementTarget.x - initial.x, this.movementTarget.z - initial.z) > 0.75;
        for (let i = 0; i < this.horizontalActions.length; i++) {
            const input = this.horizontalActions[i];
            const forward = input.forward;
            const strafe = input.strafe;
            const action = { forward, strafe, vertical: 0, sprint: sprint && forward > 0 };
            const state = this.copyState(initial);
            this.simulateTick(state, action, flyingSpeed);
            const stopX = state.x + state.vx / (1 - this.HORIZONTAL_DRAG);
            const stopZ = state.z + state.vz / (1 - this.HORIZONTAL_DRAG);
            const targetDx = stopX - this.movementTarget.x;
            const targetDz = stopZ - this.movementTarget.z;
            const pathError = this.horizontalPathError(stopX, stopZ, this.segment);
            const changeCost = this.lastAction
                ? Math.abs(forward - this.lastAction.forward) * 0.6 +
                  Math.abs(strafe - this.lastAction.strafe) * 0.6 +
                  (action.sprint !== this.lastAction.sprint ? 0.2 : 0)
                : 0;
            const idleCost = stopped && needsHorizontalProgress && forward === 0 && strafe === 0 ? 50 : 0;
            ranked.push({ action, score: (targetDx * targetDx + targetDz * targetDz) * 2 + pathError * 6 + changeCost + idleCost + (forward < 0 ? 0.5 : 0) });
        }
        return ranked.sort((a, b) => a.score - b.score);
    }

    rankVerticalActions(initial) {
        const stoppingY = initial.y + initial.vy / (1 - this.VERTICAL_DRAG);
        const error = this.verticalTargetY - stoppingY;
        let command = this.verticalCommand;

        if (command > 0 && error <= this.VERTICAL_STOP_ERROR) command = 0;
        if (command < 0 && error >= -this.VERTICAL_STOP_ERROR) command = 0;

        if (command === 0) {
            if (this.verticalCommand !== 0) this.verticalCoastTicks = this.VERTICAL_COAST_TICKS;
            else if (this.verticalCoastTicks > 0) this.verticalCoastTicks--;
            else if (error > this.VERTICAL_START_ERROR) command = 1;
            else if (error < -this.VERTICAL_START_ERROR) command = -1;
        }

        this.verticalCommand = command;
        return [{ vertical: command, score: 0 }];
    }

    preferCurrentAction(candidates) {
        if (!this.lastAction || !candidates.length) return;
        if (candidates[0].action.vertical !== this.lastAction.vertical) return;
        const currentIndex = candidates.findIndex(
            ({ action }) =>
                action.forward === this.lastAction.forward &&
                action.strafe === this.lastAction.strafe &&
                action.vertical === this.lastAction.vertical &&
                action.sprint === this.lastAction.sprint
        );
        const tolerance = this.actionTicks < this.MIN_ACTION_TICKS ? this.ACTION_HYSTERESIS * 2 : this.ACTION_HYSTERESIS;
        if (currentIndex <= 0 || candidates[currentIndex].score > candidates[0].score + tolerance) return;
        candidates.unshift(candidates.splice(currentIndex, 1)[0]);
    }

    sameAction(a, b) {
        return !!a && !!b && a.forward === b.forward && a.strafe === b.strafe && a.vertical === b.vertical && a.sprint === b.sprint;
    }

    simulateTick(state, action, flyingSpeed) {
        if (action) {
            const yaw = (state.yaw * Math.PI) / 180;
            const inputLength = Math.hypot(action.forward, action.strafe) || 1;
            const forward = action.forward / inputLength;
            const strafe = action.strafe / inputLength;
            if (action.forward <= 0) state.sprinting = false;
            else if (action.sprint) state.sprinting = true;
            const acceleration = flyingSpeed * (state.sprinting ? 2 : 1);

            state.vx += (-Math.sin(yaw) * forward - Math.cos(yaw) * strafe) * acceleration;
            state.vz += (Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * acceleration;
            state.vy += action.vertical * flyingSpeed * this.VERTICAL_ACCELERATION;
        }
        state.x += state.vx;
        state.y += state.vy;
        state.z += state.vz;
        state.vx *= this.HORIZONTAL_DRAG;
        state.vy *= this.VERTICAL_DRAG;
        state.vz *= this.HORIZONTAL_DRAG;
    }

    project(point, fromSegment) {
        if (this.path.length === 1) return { segment: 0, distance: 0, point: this.path[0] };

        const start = Math.max(0, fromSegment - 1);
        const end = Math.min(this.path.length - 2, fromSegment + 10);
        let best = null;

        for (let segment = start; segment <= end; segment++) {
            const a = this.path[segment];
            const b = this.path[segment + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dz = b.z - a.z;
            const lengthSq = dx * dx + dy * dy + dz * dz;
            const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengthSq)) : 0;
            const projected = { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t };
            const distanceSq = this.distanceSq(point, projected);
            if (!best || distanceSq < best.distanceSq) {
                best = { segment, distance: a.distance + Math.sqrt(lengthSq) * t, point: projected, distanceSq };
            }
        }
        return best;
    }

    pointAtDistance(distance) {
        const clamped = Math.max(0, Math.min(this.totalDistance, distance));
        let segment = 0;
        while (segment < this.path.length - 2 && this.path[segment + 1].distance < clamped) segment++;

        const a = this.path[segment];
        const b = this.path[Math.min(this.path.length - 1, segment + 1)];
        const length = b.distance - a.distance;
        const t = length ? (clamped - a.distance) / length : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, distance: clamped, segment };
    }

    pointWithHorizontalLead(position, distance, minimumLead) {
        const target = this.pointAtDistance(distance);
        if (Math.hypot(target.x - position.x, target.z - position.z) >= minimumLead) return target;

        for (let i = this.segment + 1; i < this.path.length; i++) {
            const point = this.path[i];
            if (point.distance < distance) continue;
            if (Math.hypot(point.x - position.x, point.z - position.z) >= minimumLead) {
                return { x: point.x, y: point.y, z: point.z, distance: point.distance, segment: Math.max(0, i - 1) };
            }
        }
        return target;
    }

    horizontalPathError(x, z, fromSegment) {
        if (this.path.length === 1) return (x - this.path[0].x) ** 2 + (z - this.path[0].z) ** 2;

        let best = Infinity;
        const start = Math.max(0, fromSegment - 1);
        const end = Math.min(this.path.length - 2, Math.max(fromSegment + 8, (this.movementTarget?.segment ?? fromSegment) + 2));
        for (let segment = start; segment <= end; segment++) {
            const a = this.path[segment];
            const b = this.path[segment + 1];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const lengthSq = dx * dx + dz * dz;
            const t = lengthSq ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq)) : 0;
            const errorX = x - (a.x + dx * t);
            const errorZ = z - (a.z + dz * t);
            best = Math.min(best, errorX * errorX + errorZ * errorZ);
        }
        return best;
    }

    angleBetween(a, b) {
        const lengthA = Math.hypot(a.x, a.z);
        const lengthB = Math.hypot(b.x, b.z);
        if (lengthA < 0.01 || lengthB < 0.01) return 0;
        return (Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.z * b.z) / (lengthA * lengthB)))) * 180) / Math.PI;
    }

    copyState(state) {
        return {
            x: state.x,
            y: state.y,
            z: state.z,
            vx: state.vx,
            vy: state.vy,
            vz: state.vz,
            yaw: state.yaw,
            sprinting: state.sprinting,
        };
    }

    updateRotation() {
        if (!this.rotationActive || !Player.getPlayer()) return;

        const now = Date.now();
        if (now - this.lastRotationAt < 12) return;
        const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - this.lastRotationAt) / 1000));
        this.lastRotationAt = now;
        const smoothing = 1 - Math.exp(-10 * deltaSeconds);
        const yawLimit = 180 * deltaSeconds;
        const pitchLimit = 100 * deltaSeconds;
        const yawStep = Math.max(-yawLimit, Math.min(yawLimit, MathUtils.getAngleDifference(this.currentYaw, this.targetYaw) * smoothing));
        const pitchStep = Math.max(-pitchLimit, Math.min(pitchLimit, (this.targetPitch - this.currentPitch) * smoothing));
        this.currentYaw = MathUtils.wrapTo180(this.currentYaw + yawStep);
        this.currentPitch = Math.max(-90, Math.min(90, this.currentPitch + pitchStep));
        const applied = PathRotationsUtility.applyRotationWithGCD(this.currentYaw, this.currentPitch);
        if (applied) {
            this.currentYaw = applied.yaw;
            this.currentPitch = applied.pitch;
        }
    }

    hasArrived() {
        const target = this.path[this.path.length - 1];
        const horizontalDistance = Math.hypot(Player.getX() - target.x, Player.getZ() - target.z);
        const verticalDistance = Math.abs(Player.getY() - target.y);
        const speed = Math.hypot(Player.getMotionX(), Player.getMotionY(), Player.getMotionZ());
        return horizontalDistance < 1.25 && verticalDistance < 1 && speed < 0.2;
    }

    applyAction(action) {
        const keys = {
            w: action.forward > 0,
            s: action.forward < 0,
            a: action.strafe < 0,
            d: action.strafe > 0,
            space: action.vertical > 0,
            shift: action.vertical < 0,
            sprint: action.sprint,
        };
        Object.keys(keys).forEach((key) => Client.setKey(key, keys[key]));
    }

    distanceSq(a, b) {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
    }

    releaseKeys() {
        ['w', 'a', 's', 'd', 'space', 'shift', 'sprint'].forEach((key) => Client.setKey(key, false));
    }

    stop(completed = false) {
        this.releaseKeys();
        this.isActive = false;
        this.rotationActive = false;
        this.complete = !!completed;
        this.lastAction = null;
    }

    reset() {
        if (this.isActive) this.releaseKeys();
        this.path = [];
        this.totalDistance = 0;
        this.segment = 0;
        this.progressDistance = 0;
        this.bestProgressDistance = 0;
        this.remainingDistance = 0;
        this.lastProgressAt = 0;
        this.lastAction = null;
        this.actionTicks = 0;
        this.flightStartTicks = 0;
        this.complete = false;
        this.isActive = false;
        this.rotationActive = false;
        this.movementTarget = null;
        this.currentYaw = 0;
        this.currentPitch = 0;
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.lastRotationAt = 0;
        this.verticalTargetY = null;
        this.verticalCommand = 0;
        this.verticalCoastTicks = 0;
        this.groundRecovering = false;
        this.turnAngle = 0;
    }
}

export const PathFlyer = new SimulationPathFlyer();
