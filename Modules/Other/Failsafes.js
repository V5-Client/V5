import { ModuleBase } from "../../utils/ModuleBase";

class Failsafes extends ModuleBase {
    constructor() {
        super({
            name: 'Failsafes',
            subcategory: 'Core',
            description: 'Failsafe settings.',
            tooltip: 'Failsafe config.',
        });

        this.tp = true;
        this.velocity = true;
        this.actionDelay = 500;
        
        this.addToggle(
            'TP Failsafe',
            (value) => { this.tp = value },
            'Enable tp failsafe',
            this.tp
        )
        this.addToggle(
            'Velocity Failsafe',
            (value) => { this.velocity = value },
            'Enable velocity failsafe',
            this.velocity
        )
        this.addSlider(
            'Failsafe Detection Delay (ms)',
            500,
            5000,
            this.actionDelay,
            (value) => { this.actionDelay = value },
            'Delay in milliseconds between detection of failsafe'
        );
    }
}

export default new Failsafes();
