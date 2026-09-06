import PathConfig from './PathConfig';
import { Swift } from './SwiftIntegration';
import { Jump } from './PathWalker/PathJumps';
import { Movement } from '../player/Movement';
import { Vec3d } from '../Constants';
import { Spline } from './PathSpline';

class OreRoutePathWalker {
    constructor() {
        this.active = false;
        this.goal = null;
        this.goalKey = '';
        this.path = null;
        this.pathFlags = null;
        this.pathFlagBits = null;
        this.pathIndex = 0;
        this.keyNodes = null;
        this.splinePath = null;
        this.walkTarget = null;

        register('postRenderWorld', () => this.render());
    }

    start(goal) {
        this.stop();
        this.goal = goal;
        this.goalKey = this.getGoalKey(goal);
        this.path = null;
        this.pathFlags = null;
        this.pathFlagBits = null;
        this.pathIndex = 0;
        this.keyNodes = null;
        this.splinePath = null;
        this.walkTarget = null;
        this.active = Swift.SwiftPath(
            [[Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ())]],
            [[goal.x, goal.y, goal.z]],
            false,
            0,
            PathConfig.PATHFINDER_MAX_COMPUTE
        );
        return this.active;
    }

    tick(goal, sneakNearGoal = false) {
        if (this.hasReachedGoal(goal)) {
            this.stop();
            return 'COMPLETE';
        }

        if (!this.active || this.goalKey !== this.getGoalKey(goal)) {
            if (!this.start(goal)) return 'FAILED';
        }

        if (Swift.isSearching()) {
            Client.stopMovement();
            Client.setKey('shift', sneakNearGoal && this.horizontalDistanceSq(goal.x + 0.5, goal.z + 0.5) <= 0.25);
            return 'SEARCHING';
        }

        if (!this.path) {
            const result = Swift.getResult();
            if (!result?.path_between_key_nodes?.length) {
                this.stop();
                return 'FAILED';
            }
            this.path = result.path_between_key_nodes;
            this.pathFlags = result.path_flags;
            this.pathFlagBits = result.path_flag_bits;
            this.keyNodes = result.keynodes;
            this.splinePath = Spline.generateSpline(this.path, 1);
            Spline.createLookPoints(this.splinePath);
        }

        if (this.hasReachedGoal()) {
            this.stop();
            return 'COMPLETE';
        }

        this.updatePathIndex();
        const target = this.path[Math.min(this.pathIndex + 1, this.path.length - 1)];
        this.walkTarget = { x: target.x + 0.5, y: target.y + 2.62, z: target.z + 0.5 };
        Movement.setKeysForStraightLineCoords(target.x + 0.5, target.y + 1, target.z + 0.5, false, true);
        Jump.detectJump(this.path, this.pathFlags, this.pathFlagBits);
        Client.setKey('shift', sneakNearGoal && this.horizontalDistanceSq(this.goal.x + 0.5, this.goal.z + 0.5) <= 0.25);
        Client.setKey('sprint', this.horizontalDistanceSq(this.goal.x + 0.5, this.goal.z + 0.5) > 4);
        return 'MOVING';
    }

    updatePathIndex() {
        let closestIndex = this.pathIndex;
        let closestDistance = Infinity;
        const end = Math.min(this.path.length - 1, this.pathIndex + 10);

        for (let index = this.pathIndex; index <= end; index++) {
            const node = this.path[index];
            const horizontal = this.horizontalDistanceSq(node.x + 0.5, node.z + 0.5);
            const vertical = Player.getY() - (node.y + 1);
            const distance = horizontal + vertical * vertical * 0.25;
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        this.pathIndex = Math.max(this.pathIndex, closestIndex);
        while (this.pathIndex + 1 < this.path.length) {
            const next = this.path[this.pathIndex + 1];
            if (this.horizontalDistanceSq(next.x + 0.5, next.z + 0.5) > 0.64 || Math.abs(Player.getY() - (next.y + 1)) > 1.5) break;
            this.pathIndex++;
        }
    }

    hasReachedGoal(goal = this.goal) {
        return !!goal && this.horizontalDistanceSq(goal.x + 0.5, goal.z + 0.5) <= 0.25 && Math.abs(Player.getY() - (goal.y + 1)) <= 1.5;
    }

    horizontalDistanceSq(x, z) {
        const dx = Player.getX() - x;
        const dz = Player.getZ() - z;
        return dx * dx + dz * dz;
    }

    getGoalKey(goal) {
        return goal ? `${goal.x},${goal.y},${goal.z}` : '';
    }

    getLookTarget() {
        return this.path && this.pathIndex + 1 < this.path.length - 1 ? this.walkTarget : null;
    }

    getGoalDistance() {
        return this.goal ? Math.sqrt(this.horizontalDistanceSq(this.goal.x + 0.5, this.goal.z + 0.5)) : Infinity;
    }

    render() {
        if (!this.active || !this.path) return;
        const debug = PathConfig.PATHFINDING_DEBUG;

        if ((debug || PathConfig.RENDER_KEY_NODES) && this.keyNodes?.length >= 2) {
            this.keyNodes.forEach((node) => {
                RenderUtils.drawStyledBox(new Vec3d(node.x, node.y, node.z), new RenderColor(0, 100, 200, 120), new RenderColor(0, 100, 200, 255), 4, true);
            });
        }
        if (debug || PathConfig.RENDER_FLOATING_SPLINE) Spline.drawFloatingSpline(this.splinePath);
        if (debug || PathConfig.RENDER_LOOK_POINTS) Spline.drawLookPoints();
        if ((debug || PathConfig.RENDER_LOOK_POINTS) && this.walkTarget) {
            RenderUtils.drawSizedBox(
                new Vec3d(this.walkTarget.x, this.walkTarget.y, this.walkTarget.z),
                0.4,
                0.4,
                0.4,
                new RenderColor(0, 255, 0, 180),
                true,
                1,
                true
            );
        }
    }

    stop() {
        if (this.active) {
            Swift.cancel();
            Swift.clear();
        }
        this.active = false;
        this.goal = null;
        this.goalKey = '';
        this.path = null;
        this.pathFlags = null;
        this.pathFlagBits = null;
        this.pathIndex = 0;
        this.keyNodes = null;
        this.splinePath = null;
        this.walkTarget = null;
        Jump.reset();
        Client.stopMovement();
    }
}

export const RoutePathWalker = new OreRoutePathWalker();
