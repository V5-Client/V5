import { ModuleBase } from '../../Utility/ModuleBase';
import { Utils } from '../../Utility/Utils';
import { findAndFollowPath, stopPathing } from '../../Pathfinding/PathAPI';
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
            showEnabledToggle: false,
        });

        this.bindToggleKey();

        this.currentStep = 'CHECK_AREA';

        this.wheatPoints = [
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
        this.currentIndex = 0;

        this.on('tick', () => {
            this.tick();
        });
    }

    tick() {
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
        this.currentIndex = 0;
        this.currentStep = 'WHEAT_FARMING';

        this.enableWheatNuker();

        this.pathToNextWaypoint();
    }

    pathToNextWaypoint() {
        // check if last waypoint and loop
        if (this.currentIndex >= this.wheatPoints.length) {
            this.currentIndex = 0;
        }

        const currentWaypoint = this.wheatPoints[this.currentIndex];
        const playerCurrentPos = [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())];

        Chat.message(`§ePathfinding to ${currentWaypoint.name} [${currentWaypoint.pos}] (${this.currentIndex + 1}/${this.wheatPoints.length})...`);

        findAndFollowPath(playerCurrentPos, currentWaypoint.pos, false, () => {
            if (this.enabled) {
                this.onWaypointReached();
            }
        });
    }

    onWaypointReached() {
        const reachedWaypoint = this.wheatPoints[this.currentIndex];
        Chat.message(`§aReached ${reachedWaypoint.name}!`);

        this.currentIndex++;

        this.pathToNextWaypoint();
    }

    enableWheatNuker() {
        const wheatCropsBlock = {
            name: 'Wheat Crops',
            id: 194,
        };

        Nuker.customBlockList = [wheatCropsBlock];
        Nuker.blockType = 'Custom';
        Nuker.toggle(true);
    }

    disableWheatNuker() {
        Nuker.toggle(false);
    }

    onEnable() {
        Chat.message('AutoSkyblock §aEnabled');
        this.currentStep = 'CHECK_AREA';
        this.currentIndex = 0;
    }

    onDisable() {
        Chat.message('AutoSkyblock §cDisabled');
        // stopPathing does not seem to work?
        stopPathing();
        this.disableWheatNuker();
    }
}

new AutoSkyblock();
