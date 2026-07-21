import Pathfinder from '../../../utils/pathfinder/PathFinder';
import { Guis } from '../../../utils/player/Inventory';
import { Rotations } from '../../../utils/player/Rotations';
import { ScheduleTask } from '../../../utils/ScheduleTask';
import { Utils } from '../../../utils/Utils';
import { farmingDelays } from '../FarmingDelays';

const STATES = {
    SEEKING: 'Seeking Philip',
    PATHING: 'Pathing to Philip',
    APPROACHING: 'Approaching Philip',
    OPENING: 'Opening Philip',
    EMPTYING: 'Emptying vacuum',
};
const SKIN_ID = 'minecraft:skins/299bb71d656072506bc04541cbcade06d5ec4b62';
const PATH_DISTANCE = 6;
const INTERACT_DISTANCE = 2.5;
const TIMEOUT_MS = 30_000;
const SEARCH_GOALS = [];
for (let x = -33; x <= -20; x++) {
    for (let y = 70; y <= 71; y++) {
        for (let z = -18; z <= -5; z++) SEARCH_GOALS.push([x, y, z]);
    }
}

class PhilipMacro {
    start() {
        this.running = true;
        this.completed = false;
        this.startedAt = Date.now();
        this.transition(STATES.SEEKING);
    }

    tick() {
        if (!this.running) return true;
        if (Date.now() - this.startedAt >= TIMEOUT_MS) return this.stop();
        if (this.state === STATES.OPENING) {
            if (Client.isInGui()) {
                this.transition(STATES.EMPTYING);
            } else if (Date.now() >= this.nextActionAt) {
                this.transition(STATES.SEEKING);
            }
            return;
        }
        if (Date.now() < this.nextActionAt) return;

        switch (this.state) {
            case STATES.SEEKING:
            case STATES.PATHING:
                this.seek();
                break;
            case STATES.APPROACHING:
                this.approach();
                break;
            case STATES.EMPTYING:
                this.emptyVacuum();
                break;
        }
    }

    find() {
        return World.getAllPlayers().find((player) => {
            try {
                return player.toMC().getSkin().body().texturePath().toString() === SKIN_ID;
            } catch (e) {
                return false;
            }
        });
    }

    seek() {
        const philip = this.find();
        if (!philip) {
            // philip can be out of render distance based on barn skin
            if (Pathfinder.isPathing()) return;
            this.transition(STATES.PATHING);
            Pathfinder.findPath(SEARCH_GOALS, (success) => {
                if (this.running && this.state === STATES.PATHING && !success) this.retry();
            });
            return;
        }

        // this is because pathfinder is shit, therefor we have to manually path the last distance otherwise it will cope and die
        if (philip.distanceTo(Player.getX(), Player.getY(), Player.getZ()) > PATH_DISTANCE) {
            if (Pathfinder.isPathing()) return;
            this.transition(STATES.PATHING);
            Pathfinder.findPath([[Math.floor(philip.getX()), Math.floor(philip.getY()) - 1, Math.floor(philip.getZ())]], (success) => {
                if (this.running && this.state === STATES.PATHING && !success) this.retry();
            });
            return;
        }

        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Client.unpressKeys();
        this.transition(STATES.APPROACHING);
        Rotations.lookAtVector({ x: philip.getX(), y: philip.getY() + 1.62, z: philip.getZ() });
        Rotations.onComplete(() => {
            if (this.running && this.state === STATES.APPROACHING) Client.setKey('w', true);
        });
    }

    approach() {
        const philip = this.find();
        if (!philip) return this.retry();
        if (philip.distanceTo(Player.getX(), Player.getY(), Player.getZ()) > INTERACT_DISTANCE) return;

        Client.stopMovement();
        this.transition(STATES.OPENING, 2500);
        Rotations.lookAtVector({ x: philip.getX(), y: philip.getY() + 1.62, z: philip.getZ() });
        Rotations.onComplete(() => {
            if (this.running && this.state === STATES.OPENING) Client.leftClick();
        });
    }

    emptyVacuum() {
        if (!Client.isInGui() || !Guis.clickItem('Empty Vacuum Bag', false, 'LEFT')) return this.retry();

        this.nextActionAt = Infinity;
        ScheduleTask(1, () => {
            if (!this.running || this.state !== STATES.EMPTYING) return;
            Guis.closeInv();
            this.stop();
        });
    }

    transition(state, delay = 0) {
        this.state = state;
        this.nextActionAt = Date.now() + delay;
    }

    retry() {
        this.transition(STATES.SEEKING, Utils.randomInt(farmingDelays.visitorRetryDelayMin, farmingDelays.visitorRetryDelayMax));
    }

    stop() {
        this.running = false;
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
    }
}

export const philipMacro = new PhilipMacro();
