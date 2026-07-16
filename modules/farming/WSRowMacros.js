import { FarmingMacro } from './FarmingMacro';
import { farmingSettings } from './FarmingSettings';
import { Utils } from '../../utils/Utils';

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
                'Yaw Offset',
                -45,
                45,
                { low: this.yawMin, high: this.yawMax },
                (value) => {
                    this.yawMin = value.low;
                    this.yawMax = value.high;
                },
                'Random yaw offset from cardinal.'
            );
            yawOffset.step = 0.01;
            yawOffset.precision = 2;
        }
        if (config.adjustablePitch) {
            this.addRangeSlider(
                'Pitch',
                -90,
                90,
                { low: this.pitchMin, high: this.pitchMax },
                (value) => {
                    this.pitchMin = value.low;
                    this.pitchMax = value.high;
                },
                'Random pitch.'
            );
        }
        if ([this.stationaryDelay, this.switchDelay].includes(LANE_DELAY)) this.addLaneSwitchDelaySettings();
    }

    onFarmStart(player) {
        this.laneChanging = false;
        this.ignoreTicks = this.initialDelay;
        this.yaw = farmingSettings.useMousemat ? (this.yawMin + this.yawMax) / 2 : Utils.randomFloat(this.yawMin, this.yawMax);
        const pitch = farmingSettings.useMousemat ? (this.pitchMin + this.pitchMax) / 2 : Utils.randomFloat(this.pitchMin, this.pitchMax);
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
    description: 'Designed for 16thGarden megafarm.',
    tooltip: '/visit 16thGarden for design.',
});

[
    [garden('A/D Cactus Macro'), 'farming ad cactus', -68.19, -17.4, true],
    [garden('A/D Cocoa Macro'), 'farming ad cocoa', -166.4, -79, true],
    [garden('W/S Crop Macro'), 'farming ws crop', -26.6],
    [garden('W/S Flower Macro'), 'farming ws flower', -106.88],
    [garden('W/S Melon Macro'), 'farming ws melon', -119.99, 25],
    [garden('W/S Mushroom Macro'), 'farming ws mushroom', -116.57],
    [garden('W/S Sugar Cane Macro'), 'farming ws cane', -123.61],
    [
        {
            name: 'Vertical Crop Macro',
            description: 'Designed for taunahi megafarm.',
            tooltip: 'Basic Vertical S-Shape Crop Macro.',
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
        name: 'SDS Staircase Mushroom Macro',
        description: 'Staircase Mushroom Farming.',
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
    }
);

new CycleMacro(
    {
        name: 'S-Shape Sugar Cane Macro',
        description: '45° sugar cane S-Shape.',
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
