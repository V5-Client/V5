import Pathfinder from '../../../utils/pathfinder/PathFinder';
import { chat } from '../../../utils/Chat';
import { clickItem, closeInventory, findItemInHotbar, getGuiName, setItemSlot } from '../../../utils/player/Inventory';
import { Rotations } from '../../../utils/player/Rotations';
import { ScheduleTask } from '../../../utils/ScheduleTask';
import { farmingDelays } from '../FarmingDelays';
import { rewarpSettings } from './RewarpSettings';

const STATES = {
    SEEKING: 'Seeking Philip',
    PATHING: 'Pathing to Philip',
    APPROACHING: 'Approaching Philip',
    USING_ABIPHONE: 'Using Abiphone',
    SELECTING_PHILIP: 'Selecting Philip',
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
        this.startedAt = Date.now();
        this.method = rewarpSettings.philipContactMethod;

        if (this.method === 'Pathfind') return this.transition(STATES.SEEKING);
        if (this.method === 'Abiphone') {
            const slot = findItemInHotbar('Abiphone');
            if (slot === -1) {
                chat('&cAbiphone not found in hotbar!');
                this.stop();
                return false;
            }
            setItemSlot(slot);
            return this.transition(STATES.USING_ABIPHONE, 250);
        }

        ChatLib.command('call Philip');
        this.transition(STATES.OPENING, 2500);
    }

    tick() {
        if (!this.running) return true;
        if (Date.now() - this.startedAt >= TIMEOUT_MS) return this.stop();
        if (this.state === STATES.OPENING) {
            if (Client.isInGui() && clickItem('Empty Vacuum Bag', false, 'LEFT')) return this.finish();
            if (Date.now() >= this.nextActionAt) this.retry();
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
            case STATES.USING_ABIPHONE:
                Client.rightClick();
                this.transition(STATES.SELECTING_PHILIP, 2500);
                break;
            case STATES.SELECTING_PHILIP:
                if (getGuiName()?.includes('Abiphone') && clickItem('Philip', false, 'LEFT')) this.transition(STATES.OPENING, 2500);
                else if (Date.now() >= this.nextActionAt) this.retry();
                break;
            case STATES.EMPTYING:
                break;
        }
    }

    find() {
        return World.getAllPlayers().find((player) => {
            try {
                const mcPlayer = player.toMC();
                return mcPlayer instanceof net.minecraft.client.player.AbstractClientPlayer && mcPlayer.getSkin().body().texturePath().toString() === SKIN_ID;
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
    }

    approach() {
        const philip = this.find();
        if (!philip) return this.retry();
        if (philip.distanceTo(Player.getX(), Player.getY(), Player.getZ()) > INTERACT_DISTANCE) {
            Rotations.lookAtVector({ x: philip.getX(), y: philip.getY() + 1.62, z: philip.getZ() });
            Client.setKey('w', true);
            Client.setKey('shift', true);
            return;
        }

        Client.stopMovement();
        this.transition(STATES.OPENING, 2500);
        Rotations.lookAtVector({ x: philip.getX(), y: philip.getY() + 1.62, z: philip.getZ() });
        Rotations.onComplete(() => {
            if (this.running && this.state === STATES.OPENING) Client.leftClick();
        });
    }

    finish() {
        this.transition(STATES.EMPTYING, Infinity);
        ScheduleTask(1, () => {
            if (!this.running || this.state !== STATES.EMPTYING) return;
            closeInventory();
            this.stop();
        });
    }

    transition(state, delay = 0) {
        this.state = state;
        this.nextActionAt = Date.now() + delay;
    }

    retry() {
        Client.stopMovement();
        if (Client.isInGui()) closeInventory();
        if (this.method === 'Pathfind') return this.transition(STATES.SEEKING, farmingDelays.random('visitorRetry'));
        if (this.method === 'Abiphone') return this.transition(STATES.USING_ABIPHONE, farmingDelays.random('visitorRetry'));
        ChatLib.command('call Philip');
        this.transition(STATES.OPENING, 2500);
    }

    stop() {
        this.running = false;
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
    }
}

export const philipMacro = new PhilipMacro();
