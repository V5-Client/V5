import { ModuleBase } from '../../Utility/ModuleBase';
import { Utils } from '../../Utility/Utils';
import { findAndFollowPath, stopPathing } from '../../Pathfinding2.0/PathAPI';
import { loadMap } from '../../Pathfinding2.0/Connection';
import { Nuker } from '../Mining/Nuker';
import { Chat } from '../../Utility/Chat';
import { Time } from '../../Utility/Timing';

class AutoSkyblock extends ModuleBase {
    constructor() {
        super({
            name: 'AutoSkyblock',
            subcategory: 'Other',
            description: 'Completes the early game automatically',
            tooltip: 'Automatically completes early Skyblock tasks',
        });

        this.bindToggleKey();

        this.currentStep = 'CHECK_AREA';
        this.checkInterval = 500;
        this.lastCheck = 0;

        this.hubWheatFarmWaypoints = [
            { pos: [36, 69, -120], name: 'Wheat Farm Start' },
            { pos: [54, 70, -126], name: 'Wheat Farm Point 1' },
            { pos: [67, 70, -132], name: 'Wheat Farm Point 2' },
            { pos: [67, 70, -139], name: 'Wheat Farm Point 3' },
            { pos: [60, 70, -139], name: 'Wheat Farm Point 4' },
            { pos: [33, 69, -147], name: 'Wheat Farm Point 5' },
            { pos: [25, 69, -148], name: 'Wheat Farm Point 6' },
            { pos: [33, 69, -139], name: 'Wheat Farm Point 7' },
            { pos: [22, 69, -139], name: 'Wheat Farm Point 8' },
            { pos: [27, 69, -130], name: 'Wheat Farm End' },
        ];
        this.currentWaypointIndex = 0;

        this.on('step', () => {
            if (Date.now() - this.lastCheck < this.checkInterval) return;
            this.lastCheck = Date.now();

            this.handleCurrentStep();
        });
    }

    handleCurrentStep() {
        switch (this.currentStep) {
            case 'CHECK_AREA':
                this.checkArea();
                break;
            case 'GOING_TO_HUB':
                this.checkIfInHub();
                break;
            case 'WHEAT_FARMING':
                // callback :D
                break;
        }
    }

    checkArea() {
        const area = Utils.area();
        Chat.message(`§eCurrent area: ${area}`);

        if (area !== 'Hub') {
            Chat.message('§eNot in Hub, warping...');
            ChatLib.command('hub');
            this.currentStep = 'GOING_TO_HUB';
        } else {
            Chat.message('§aAlready in Hub, starting wheat farm route...');
            this.startWheatFarmSequence();
        }
    }

    checkIfInHub() {
        const area = Utils.area();

        if (area === 'Hub') {
            Chat.message('§aArrived in Hub, starting wheat farm route...');
            this.startWheatFarmSequence();
        }
    }

    startWheatFarmSequence() {
        this.currentWaypointIndex = 0;
        this.currentStep = 'WHEAT_FARMING';

        this.enableWheatNuker();

        this.pathToNextWaypoint();
    }

    pathToNextWaypoint() {
        if (this.currentWaypointIndex >= this.hubWheatFarmWaypoints.length) {
            // Loop
            Chat.message('§aCompleted loop, restarting from beginning...');
            this.currentWaypointIndex = 0;
        }

        const currentWaypoint =
            this.hubWheatFarmWaypoints[this.currentWaypointIndex];
        const playerCurrentPos = [
            Math.floor(Player.getX()),
            Math.round(Player.getY()) - 1,
            Math.floor(Player.getZ()),
        ];

        Chat.message(
            `§ePathfinding to ${currentWaypoint.name} [${
                currentWaypoint.pos
            }] (${this.currentWaypointIndex + 1}/${
                this.hubWheatFarmWaypoints.length
            })...`
        );

        findAndFollowPath(playerCurrentPos, currentWaypoint.pos, false, () =>
            this.onWaypointReached()
        );
    }

    onWaypointReached() {
        const reachedWaypoint =
            this.hubWheatFarmWaypoints[this.currentWaypointIndex];
        Chat.message(`§aReached ${reachedWaypoint.name}!`);

        this.currentWaypointIndex++;

        setTimeout(() => {
            this.pathToNextWaypoint();
        }, 100);
    }

    enableWheatNuker() {
        const wheatCropsBlock = {
            name: 'Wheat Crops',
            id: 194,
        };

        Nuker.customBlockList = [wheatCropsBlock];
        Nuker.blockType = 'Custom';

        if (!Nuker.enabled) {
            Nuker.toggle();
        }

        Chat.message('§aWheat nuker enabled');
    }

    disableWheatNuker() {
        if (Nuker.enabled) {
            Nuker.toggle();
        }
        Chat.message('§cWheat nuker disabled');
    }

    onEnable() {
        Chat.message('§aAutoSkyblock enabled, starting sequence...');
        this.currentStep = 'CHECK_AREA';
        this.currentWaypointIndex = 0;
        this.lastCheck = 0;
    }

    onDisable() {
        Chat.message('§cAutoSkyblock disabled');
        stopPathing();
        this.disableWheatNuker();
        this.currentStep = 'CHECK_AREA';
        this.currentWaypointIndex = 0;
    }
}

new AutoSkyblock();
