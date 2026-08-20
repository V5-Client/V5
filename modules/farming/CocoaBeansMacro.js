import { FarmingMacro } from './FarmingMacro';

const STATES = {
    FORWARD: 'Forward',
    BACKWARD: 'Backward',
    SWITCHING_LANE: 'Switching lane',
};

class CocoaBeansMacro extends FarmingMacro {
    constructor() {
        super(
            {
                name: 'modules.forward_s_shape_cocoa_macro.name',
                description: 'modules.forward_s_shape_cocoa_macro.description',
            },
            'farming cocoa'
        );

        this.state = STATES.FORWARD;
        this.lastDirection = STATES.FORWARD;
        this.moveLeft = true;
        this.addToggle('labels.move_left', (value) => (this.moveLeft = !!value), 'descriptions.move_left', true);
    }

    onFarmStart(player) {
        this.state = STATES.FORWARD;
        this.lastDirection = STATES.FORWARD;
        this.rotateTo(this.snapYaw(player.getYRot(), 0), -45);
    }

    updateFarmState(player) {
        if (!this.isStationaryForTicks(player, 2)) return;

        if (this.state === STATES.SWITCHING_LANE) {
            this.state = this.lastDirection === STATES.FORWARD ? STATES.BACKWARD : STATES.FORWARD;
            return;
        }

        this.lastDirection = this.state;
        this.state = STATES.SWITCHING_LANE;
    }

    invokeFarmState() {
        if (this.state === STATES.FORWARD) return this.hold('w');
        if (this.state === STATES.BACKWARD) return this.hold('s');
        this.hold(this.moveLeft ? 'a' : 'd');
    }
}

new CocoaBeansMacro();
