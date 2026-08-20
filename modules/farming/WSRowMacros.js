import { FarmingMacro } from './FarmingMacro';
import { farmingSettings } from './FarmingSettings';
import { randomFloat } from '../../utils/Utils';

const LANE_DELAY = 'lane';
const WS_MOVEMENTS = [
    ['Forward', 'w'],
    ['Backward', 's'],
];
const AD_MOVEMENTS = [
    ['Forward', 'a'],
    ['Backward', 'd'],
];

class CycleMacro extends FarmingMacro {
    constructor(options, commandPrefix, config) {
        super(options, commandPrefix);
        this.yawMin = this.yawMax = ((((config.yaw + 45) % 90) + 90) % 90) - 45;
        this.pitchMin = this.pitchMax = config.pitch || 0;
        this.movements = config.movements;
        this.state = this.movements[0][0];
        this.initialDelay = config.initialDelay ?? 20;
        this.stationaryDelay = config.stationaryDelay ?? 2;
        this.switchDelay = config.switchDelay ?? 2;
        this.laneChangeKey = config.laneChangeKey;

        if (![0, 45].includes(config.yaw)) {
            const yawOffset = this.addRangeSlider(
                'labels.yaw_offset',
                -45,
                45,
                { low: this.yawMin, high: this.yawMax },
                (value) => {
                    this.yawMin = value.low;
                    this.yawMax = value.high;
                },
                'descriptions.yaw_offset'
            );
            yawOffset.step = 0.01;
            yawOffset.precision = 2;
        }
        if (config.adjustablePitch) {
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
        if ([this.stationaryDelay, this.switchDelay].includes(LANE_DELAY)) this.addLaneSwitchDelaySettings();
    }

    onFarmStart(player) {
        this.laneChanging = false;
        this.ignoreTicks = this.initialDelay;
        this.yaw = farmingSettings.useMousemat ? (this.yawMin + this.yawMax) / 2 : randomFloat(this.yawMin, this.yawMax);
        const pitch = farmingSettings.useMousemat ? (this.pitchMin + this.pitchMax) / 2 : randomFloat(this.pitchMin, this.pitchMax);
        this.rotateTo(this.snapYaw(player.getYRot(), this.yaw), pitch);
    }

    updateFarmState(player) {
        if (this.consumeIgnoreTicks(player)) return;

        this.laneChanging ||= Boolean(this.laneChangeKey) && this.state === this.movements[0][0] && this.isMovingInLaneChangeDirection(player);

        if (!this.stationaryTicks) this.stationaryDelayTicks = this.stationaryDelay === LANE_DELAY ? this.getLaneSwitchDelayTicks() : this.stationaryDelay;
        if (!this.isStationaryForTicks(player, this.stationaryDelayTicks)) return;

        const index = this.movements.findIndex(([state]) => state === this.state);
        this.state = this.movements[(index + 1) % this.movements.length][0];
        this.laneChanging = false;
        this.ignoreTicks = this.switchDelay === LANE_DELAY ? this.getLaneSwitchDelayTicks() : this.switchDelay;
    }

    isMovingInLaneChangeDirection(player) {
        const yaw = ((this.farmingRotation?.yaw ?? player.getYRot()) * Math.PI) / 180;
        const direction = this.laneChangeKey === 's' ? 1 : -1;
        return ((player.getX() - this.previousTickX) * Math.sin(yaw) - (player.getZ() - this.previousTickZ) * Math.cos(yaw)) * direction > 0.01;
    }

    invokeFarmState() {
        const movement = this.movements.find(([state]) => state === this.state)[1];
        this.hold(this.laneChanging ? `${movement}${this.laneChangeKey}` : movement);
    }
}

const garden = (name) => ({
    name,
    description: name.replace(/\.name$/, '.description'),
    tooltip: name.replace(/\.name$/, '.tooltip'),
});

[
    [garden('modules.a_d_cactus_macro.name'), 'farming ad cactus', -68.19, -17.4, true],
    [garden('modules.a_d_cocoa_macro.name'), 'farming ad cocoa', -166.4, -79, true],
    [garden('modules.w_s_crop_macro.name'), 'farming ws crop', -26.6],
    [garden('modules.w_s_flower_macro.name'), 'farming ws flower', -106.88],
    [garden('modules.w_s_melon_macro.name'), 'farming ws melon', -119.99, 25],
    [garden('modules.w_s_mushroom_macro.name'), 'farming ws mushroom', -116.57],
    [garden('modules.w_s_sugar_cane_macro.name'), 'farming ws cane', -123.61],
    [
        {
            name: 'modules.vertical_crop_macro.name',
            description: 'modules.vertical_crop_macro.description',
            tooltip: 'modules.vertical_crop_macro.tooltip',
        },
        'farming ad vertical',
        0,
        0,
        true,
    ],
].forEach(([options, commandPrefix, yaw, pitch = 0, usesAD = false]) => {
    new CycleMacro(options, commandPrefix, {
        yaw,
        pitch,
        movements: usesAD ? AD_MOVEMENTS : WS_MOVEMENTS,
        stationaryDelay: LANE_DELAY,
        switchDelay: 5,
        adjustablePitch: true,
    });
});

new CycleMacro(
    {
        name: 'modules.sds_staircase_mushroom_macro.name',
        description: 'modules.sds_staircase_mushroom_macro.description',
    },
    'farming sds mushroom',
    {
        yaw: -16,
        pitch: 6.7,
        movements: [
            ['Left', 'a'],
            ['Right', 'sd'],
        ],
        laneChangeKey: 's',
        adjustablePitch: true,
    }
);

new CycleMacro(
    {
        name: 'modules.s_shape_sugar_cane_macro.name',
        description: 'modules.s_shape_sugar_cane_macro.description',
    },
    'farming cane',
    {
        yaw: 45,
        movements: [
            ['Left', 'a'],
            ['Backward', 's'],
        ],
        initialDelay: 5,
        switchDelay: LANE_DELAY,
    }
);
