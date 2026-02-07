import { Keybind } from '../../player/Keybinding';
import { PathExecutor } from '../PathExecutor';

class PathMovement {
    constructor() {
        this.path = [];
        this.currentIndex = 0;
        this.isActive = false;
        this.ARRIVAL_THRESHOLD_XZ = 0.8;
        this.isLifting = false;
        this.isDescending = false;

        PathExecutor.onTick(() => {
            if (!this.isActive || !this.path || this.path.length === 0) return;
            const player = Player.getPlayer();
            if (!player) return;
            if (!player.getAbilities().flying) {
                player.getAbilities().flying = true;
                player.sendAbilitiesUpdate();
            }
            this.updateMovement();
        });
    }

    beginMovement(smoothPath) {
        if (!smoothPath || smoothPath.length === 0) return;
        this.path = smoothPath;
        this.isActive = true;
    }

    updateMovement() {
        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();

        let furthestReached = this.currentIndex;
        for (let i = this.currentIndex; i < Math.min(this.currentIndex + 25, this.path.length); i++) {
            const pt = this.path[i];
            const distSqXZ = Math.pow(pt.x - pX, 2) + Math.pow(pt.z - pZ, 2);
            if (distSqXZ < Math.pow(this.ARRIVAL_THRESHOLD_XZ, 2)) {
                furthestReached = i + 1;
            }
        }
        this.currentIndex = furthestReached;

        if (this.currentIndex >= this.path.length) {
            this.stopMovement();
            return;
        }

        const target = this.path[this.currentIndex];
        const distSqToTarget = Math.pow(target.x - pX, 2) + Math.pow(target.z - pZ, 2);

        if (distSqToTarget > Math.pow(4, 2)) {
            let closestDist = Infinity;
            let closestIndex = this.currentIndex;
            for (let i = 0; i < this.path.length; i++) {
                const d = Math.pow(this.path[i].x - pX, 2) + Math.pow(this.path[i].z - pZ, 2);
                if (d < closestDist) {
                    closestDist = d;
                    closestIndex = i;
                }
            }
            this.currentIndex = closestIndex;
        }

        const diffY = pY - target.y;

        if (diffY < -1.5) {
            this.isLifting = true;
        } else if (diffY > 0.5) {
            this.isLifting = false;
        }

        if (diffY > 2.0) {
            this.isDescending = true;
        } else if (diffY < 0.5) {
            this.isDescending = false;
        }

        Keybind.setKey('w', true);
        Keybind.setKey('sprint', true);
        Keybind.setKey('space', this.isLifting);
        Keybind.setKey('shift', this.isDescending);
    }

    stopMovement() {
        if (!this.isActive) return;
        this.isActive = false;
        this.isLifting = false;
        this.isDescending = false;
        ['w', 'space', 'shift', 'sprint'].forEach((key) => Keybind.setKey(key, false));
    }
}

export const FlyMovement = new PathMovement();
