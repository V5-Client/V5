import { FarmingMacro } from './FarmingMacro';
import { farmingSettings } from './FarmingSettings';
import { randomFloat } from '../../utils/Utils';

const STATES = {
    LEFT: 'Left',
    RIGHT: 'Right',
    SWITCHING_LANE: 'Switching lane',
};
class SShapeCropMacro extends FarmingMacro {
    constructor() {
        super(
            {
                name: 'modules.s_shape_macro.name',
                description: 'modules.s_shape_macro.description',
            },
            'farming sshape'
        );

        this.pitchMin = this.pitchMax = 0;
        this.laneChangeKey = 'w';
        this.alwaysHoldLaneChangeKey = false;
        this.state = STATES.LEFT;
        this.lastDirection = STATES.LEFT;
        this.addLaneSwitchDelaySettings();
        this.addMultiToggle(
            'labels.lane_change_direction',
            ['options.forward', 'options.backward'],
            true,
            (value) => (this.laneChangeKey = value.find((option) => option.enabled)?.name === 'Backward' ? 's' : 'w'),
            null,
            'Forward'
        );
        this.addToggle('labels.always_hold_lane_change_key', (value) => (this.alwaysHoldLaneChangeKey = value));
        const pitch = this.addRangeSlider(
            'labels.pitch',
            -90,
            90,
            { low: this.pitchMin, high: this.pitchMax },
            (value) => {
                this.pitchMin = value.low;
                this.pitchMax = value.high;
            },
            'descriptions.random_pitch'
        );
        pitch.step = 0.01;
        pitch.precision = 2;
    }

    onFarmStart(player) {
        this.state = this.lastDirection;
        this.ignoreTicks = 10;
        this.yaw = this.snapYaw(player.getYRot(), 0);
        const pitch = farmingSettings.useMousemat ? (this.pitchMin + this.pitchMax) / 2 : randomFloat(this.pitchMin, this.pitchMax);
        this.rotateTo(this.yaw, pitch);
    }

    updateFarmState(player) {
        if (this.state === STATES.SWITCHING_LANE) return this.updateLaneSwitch(player);
        if (this.consumeIgnoreTicks(player)) return;

        if (!this.isStationaryForTicks(player, 2)) return;
        if (this.alwaysHoldLaneChangeKey) {
            this.state = this.lastDirection === STATES.RIGHT ? STATES.LEFT : STATES.RIGHT;
            this.lastDirection = this.state;
            return;
        }
        this.state = STATES.SWITCHING_LANE;
    }

    updateLaneSwitch(player) {
        if (!this.isStationaryForTicks(player, 2)) return;
        this.state = this.lastDirection === STATES.RIGHT ? STATES.LEFT : STATES.RIGHT;
        this.lastDirection = this.state;
        this.ignoreTicks = this.getLaneSwitchDelayTicks();
    }

    invokeFarmState() {
        if (this.state === STATES.LEFT) return this.hold(`a${this.alwaysHoldLaneChangeKey ? this.laneChangeKey : ''}`);
        if (this.state === STATES.RIGHT) return this.hold(`d${this.alwaysHoldLaneChangeKey ? this.laneChangeKey : ''}`);
        this.hold(this.laneChangeKey);
    }
}

new SShapeCropMacro();
