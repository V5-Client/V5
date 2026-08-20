import { FarmingMacro } from './FarmingMacro';

const STATES = {
    LEFT: 'Left',
    RIGHT: 'Right',
    ROTATING: 'Rotating',
};

class ADRotatingMelonMacro extends FarmingMacro {
    constructor() {
        super(
            {
                name: 'modules.ad_rotating_melon_macro.name',
                description: 'modules.ad_rotating_melon_macro.description',
            },
            'farming melon'
        );

        this.state = STATES.LEFT;
        this.startState = STATES.LEFT;

        this.addMultiToggle(
            'labels.direction',
            ['options.a', 'options.d'],
            true,
            (value) => {
                this.startState = value.find((option) => option.enabled)?.name === 'D' ? STATES.RIGHT : STATES.LEFT;
            },
            'descriptions.direction_ad_rotating_melon',
            'A'
        );
        this.addLaneSwitchDelaySettings();
    }

    onFarmStart(player) {
        this.state = this.startState;
        this.ignoreTicks = 5;
        this.leftYaw = this.snapYaw(player.getYRot(), 45) - (this.state === STATES.RIGHT ? 90 : 0);
        this.rotateTo(this.state === STATES.LEFT ? this.leftYaw : this.leftYaw + 90, 42);
    }

    updateFarmState(player) {
        if (this.state === STATES.ROTATING || this.consumeIgnoreTicks(player)) return;
        if (!this.isStationaryForTicks(player, 2)) return;

        this.nextState = this.state === STATES.LEFT ? STATES.RIGHT : STATES.LEFT;
        this.state = STATES.ROTATING;
        this.rotateTo(this.nextState === STATES.LEFT ? this.leftYaw : this.leftYaw + 90, 42, () => {
            if (!this.enabled) return;
            this.state = this.nextState;
            this.ignoreTicks = this.getLaneSwitchDelayTicks();
        });
    }

    invokeFarmState() {
        if (this.state === STATES.ROTATING) return this.hold();
        this.hold(this.state === STATES.LEFT ? 'a' : 'd');
    }
}

new ADRotatingMelonMacro();
