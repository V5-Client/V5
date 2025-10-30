import { Chat } from '../../Utility/Chat';
import { findAndFollowPath, stopPathing } from '../../Pathfinding2.0/PathAPI';
import { COMMISSION_DATA } from './CommissionData';
import { registerEventSB } from '../../Utility/SkyblockEvents';
import { MiningBot } from './MiningBot';
import { MiningUtils } from '../../Utility/MiningUtils';
import { Guis } from '../../Utility/Inventory';
import { Keybind } from '../../Utility/Keybinding';
import { Rotations } from '../../Utility/Rotations';
import { ModuleBase } from '../../Utility/ModuleBase';
import { MathUtils } from '../../Utility/Math';
import { Utils } from '../../Utility/Utils';
import { loadMap } from '../../Pathfinding2.0/Connection';
import { PathComplete } from '../../Pathfinding2.0/PathWalker/PathRotations';
import { RotationRedo } from '../../Utility/RotationsTest';
import { getPlayerLookVec } from '../../Dependencies/BloomCore/RaytraceBlocks';

class CommissionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Commission Macro',
            subcategory: 'Mining',
            description: 'Completes Commissions for you',
            tooltip: 'Completes Commissions for you (Dwarven). Use /startcommission and /stopcommission',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
        });

        this.STATES = {
            WAITING: 0,
            FORGE: 1,
            COMMISSION: 2,
            TRAVELLING: 3,
            MINING: 4,
            SLAYER: 5,
            EMISSIARY: 6,
            COLLECTING: 7,
        };

        this.state = this.STATES.FORGE;

        this.warped = false;
        this.loadedMap = false;

        this.bindToggleKey();
        // this.currentState = STATES.IDLE;
        this.playerAvoidanceRadius = 10;
        this.goblinWeaponSlot = 1;
        this.swapPickaxeStep = 0;
        this.pauseTicks = 0;

        this.commissions = [];
        this.currentCommission = null;
        this.currentMobType = null;
        this.mobWhitelist = new Set();
        this.savedState = null;
        this.awaitingTabUpdate = false;
        this.travelPurpose = null;

        this.drill = null;
        this.blueCheese = null; // unused rn
        this.pickaxe = null;
        this.weapon = null;
        this.miningSpeed = 0;
        this.currentMiningWaypoint = null;

        const EMISSARY_LOCATIONS = [
            [129, 195, 196],
            [42, 134, 22],
            [171, 149, 31],
            [-73, 152, -11],
            [-133, 173, -51],
            [89, 197, -93],
            [58, 197, -8],
        ];

        this.on('chat', (event) => {
            if (this.state === this.STATES.MINING || this.state === this.STATES.SLAYER) {
                const msg = event.message.getUnformattedText();

                if (msg.includes('Commission Complete! Visit the King to claim')) this.state = this.STATES.EMISSIARY;
            }
        });

        this.closestLocation = null;
        this.minDistance = Infinity;

        this.on('tick', () => {
            if (Utils.area() !== 'Dwarven Mines' && !this.loadedMap) {
                loadMap('mines');
                this.loadedMap = true;
            }

            switch (this.state) {
                case this.STATES.FORGE:
                    let distance = MathUtils.getDistanceToPlayer(0, 148, -69);
                    let dist = distance.distanceFlat;

                    if (dist < 10 && Utils.area() === 'Dwarven Mines') {
                        this.state = this.STATES.COMMISSION;
                        return;
                    }

                    if (this.warped) return;
                    this.message('Warping to forge.');
                    ChatLib.command('warp forge');
                    this.warped = true;
                    break;
                case this.STATES.COMMISSION:
                    const tabItems = TabList.getNames();

                    const cleanText = (text) => ChatLib.removeFormatting(text ?? '').trim();

                    const startIndex = tabItems.findIndex((item) => cleanText(item) === 'Commissions:');

                    const maxLines = 4;
                    let endIndex = Math.min(startIndex + 1 + maxLines, tabItems.length);

                    let newCommissions = [];

                    for (let i = startIndex + 1; i < endIndex; i++) {
                        const fullCommissionText = cleanText(tabItems[i]);
                        if (!fullCommissionText.includes(':')) continue;

                        const parts = fullCommissionText.split(':');
                        const name = parts[0].trim();
                        const display = parts[1].trim();

                        if (display.length === 0 || display === 'DONE') continue;

                        newCommissions.push({
                            name,
                            display,
                        });
                    }

                    // simplify this if you can/want
                    this.commissions = newCommissions;

                    const knownCommissionNames = COMMISSION_DATA.map((data) => data.names).reduce((acc, val) => acc.concat(val), []);

                    const filterableCommissions = this.commissions.filter((activeComm) => knownCommissionNames.includes(activeComm.name));

                    if (filterableCommissions.length > 0) {
                        const randomIndex = this.random(filterableCommissions.length);
                        const randomCommission = filterableCommissions[randomIndex];

                        const commissionData = COMMISSION_DATA.find((data) => data.names.includes(randomCommission.name));

                        this.commission = {
                            name: randomCommission.name,
                            display: randomCommission.display,

                            ...commissionData,
                        };

                        if (!this.commission) return; // do stiff here when no comm like click pigeon

                        this.message(`&f${this.commission.name} &7(&b${this.commission.type}&7)`);
                    }

                    if (this.commission) this.state = this.STATES.TRAVELLING;
                    break;
                case this.STATES.TRAVELLING:
                    this.message(`Pathing to ${this.commission.name} location!`);

                    const waypoints = this.commission.waypoints;
                    const randomIndex = this.random(waypoints.length);
                    const targetWaypoint = waypoints[randomIndex];

                    const PathComplete = () => {
                        if (this.commission.type === 'MINING') this.state = this.STATES.MINING;
                        if (this.commission.type === 'SLAYER') this.state = this.STATES.SLAYER;
                    };

                    findAndFollowPath(
                        [Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ())],
                        targetWaypoint,
                        false,
                        PathComplete
                    );
                    this.state = this.STATES.WAITING;
                    break;
                case this.STATES.MINING:
                    //  Chat.message('MINING COMM');
                    break;
                case this.STATES.SLAYER:
                    // Chat.message('SLAYER COM');
                    break;
                case this.STATES.EMISSIARY:
                    Chat.message('WERE HERE');
                    const onPathComplete = () => {
                        this.message('Arrived at Emissary. Commission reward collected.');
                        this.state = this.STATES.COLLECTING;
                    };

                    const startPosition = [Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ())];

                    for (const location of EMISSARY_LOCATIONS) {
                        let distance = MathUtils.getDistanceToPlayer(location[0], location[1], location[2]).distance;

                        Chat.message(distance);

                        if (distance < this.minDistance) {
                            this.minDistance = distance;
                            this.closestLocation = location;
                        }
                    }

                    if (this.closestLocation) {
                        this.message(`Pathing to closest Emissary at [${this.closestLocation.join(', ')}]`);

                        findAndFollowPath(startPosition, this.closestLocation, false, onPathComplete);

                        this.state = this.STATES.WAITING;
                    }
                    break;
                case this.STATES.COLLECTING:
                    RotationRedo.rotateToVector([
                        this.closestLocation[0] + 0.5,
                        this.closestLocation[1] + 2, // its somehow 2 blocks?
                        this.closestLocation[2] + 0.5,
                    ]);
                    break;
            }
        });
    }

    random(length) {
        return Math.floor(Math.random() * length);
    }

    message(msg) {
        Chat.message('&#1A78C4Commission Macro: &f' + msg);
    }
}

new CommissionMacro();
