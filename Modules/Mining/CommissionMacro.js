import { Chat } from '../../Utility/Chat';
import { findAndFollowPath, stopPathing } from '../../Pathfinding/PathAPI';
import { COMMISSION_DATA } from './CommissionData';
const { addSlider, addCategoryItem } = global.Categories;

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    TRAVELING: 'Traveling to Location',
    WAITING_FOR_SPOT: 'Waiting for Spot',
};

class CommissionMacro {
    constructor() {
        this.enabled = false;
        this.currentState = STATES.IDLE;
        this.playerAvoidanceRadius = 10;

        this.commissions = [];
        this.lastCommissionCheck = 0;
        this.currentCommission = null;
        this.hasWarned = false;
        this.mobWhitelist = new Set();

        register('command', () => {
            this.toggle(true);
        }).setName('startcommission', true);

        register('command', () => {
            this.toggle(false);
        }).setName('stopcommission', true);

        register('step', () => {
            if (!this.enabled) return;

            if (Date.now() - this.lastCommissionCheck > 5000) {
                this.readCommissions();
                this.lastCommissionCheck = Date.now();
            }
        }).setDelay(1);

        register('tick', () => {
            if (!this.enabled) return;
            this.runLogic();
        });

        register('worldUnload', () => {
            if (!this.enabled) return;

            this.toggle(false);
            Chat.message('Commission Macro: &cDisabled due to world change');
        });

        addCategoryItem(
            'Mining',
            'Commission Macro',
            'Completes Commissions for you',
            'Completes Commissions for you (Dwarven). Use /startcommission and /stopcommission'
        );

        addSlider(
            'Modules',
            'Commission Macro',
            'Player Avoidance Radius',
            0,
            200,
            10,
            (value) => {
                this.playerAvoidanceRadius = value;
            },
            'How close another player can be to a mining spot before it is considered occupied.',
            this.playerAvoidanceRadius
        );
    }

    toggle(forceAState = null) {
        if (forceAState !== null) {
            this.enabled = forceAState;
        } else {
            this.enabled = !this.enabled;
        }

        if (this.enabled) {
            Chat.message('&aCommission Macro Enabled.');
            this.init();
        } else {
            Chat.message('&cCommission Macro Disabled.');
            stopPathing();
            this.cleanup();
        }
    }

    init() {
        this.currentState = STATES.IDLE;
        this.commissions = [];
        this.lastCommissionCheck = 0;
        this.currentCommission = null;
        this.hasWarned = false;
    }

    cleanup() {
        this.currentState = STATES.IDLE;
        this.currentCommission = null;
    }

    setState(newState) {
        if (this.currentState !== newState) {
            Chat.message(`&aCommission Macro: &eChanging state to ${newState}`);
            this.currentState = newState;
        }
    }

    runLogic() {
        if (!this.enabled) return;

        if (this.currentState === STATES.IDLE) {
            if (this.commissions.some((c) => c.progress < 1)) {
                this.setState(STATES.CHOOSING);
            }
        } else if (this.currentState === STATES.CHOOSING) {
            this.chooseAndStartCommission();
        } else if (this.currentState === STATES.WAITING_FOR_SPOT) {
            this.setState(STATES.CHOOSING);
        }
    }

    chooseAndStartCommission() {
        const activeCommissions = this.commissions.filter(
            (c) => c.progress < 1
        );

        if (activeCommissions.length === 0) {
            this.setState(STATES.IDLE);
            return;
        }

        const possibleTasks = activeCommissions
            .map((tabComm) => {
                const data = COMMISSION_DATA.find((d) =>
                    d.names.includes(tabComm.name)
                );
                return data ? { ...tabComm, ...data } : null;
            })
            .filter((task) => task && task.type === 'MINING');

        if (possibleTasks.length === 0) {
            if (!this.hasWarned) {
                Chat.message('&eNo supported mining commissions available.');
                this.hasWarned = true;
            }
            this.setState(STATES.IDLE);
            return;
        }

        this.hasWarned = false;

        possibleTasks.sort((a, b) => a.cost - b.cost);

        const otherPlayers =
            this.playerAvoidanceRadius > 0
                ? World.getAllPlayers().filter(
                      (p) => p.getName() !== Player.getName()
                  )
                : [];

        for (let i = 0; i < possibleTasks.length; i++) {
            const chosenTask = possibleTasks[i];

            const safeWaypoints = chosenTask.waypoints.filter((waypoint) => {
                if (this.playerAvoidanceRadius <= 0) return true;

                return !otherPlayers.some((player) => {
                    const distance = Math.hypot(
                        player.getX() - waypoint[0],
                        player.getY() - waypoint[1],
                        player.getZ() - waypoint[2]
                    );
                    return distance < this.playerAvoidanceRadius;
                });
            });

            if (safeWaypoints.length > 0) {
                const playerPos = {
                    x: Player.getX(),
                    y: Player.getY(),
                    z: Player.getZ(),
                };

                let closestWaypoint = safeWaypoints.reduce(
                    (closest, current) => {
                        const closestDist = Math.hypot(
                            playerPos.x - closest[0],
                            playerPos.y - closest[1],
                            playerPos.z - closest[2]
                        );
                        const currentDist = Math.hypot(
                            playerPos.x - current[0],
                            playerPos.y - current[1],
                            playerPos.z - current[2]
                        );
                        return currentDist < closestDist ? current : closest;
                    },
                    safeWaypoints[0]
                );

                this.currentCommission = chosenTask;
                const destination = closestWaypoint;
                const startPos = [
                    Math.floor(Player.getX()),
                    Math.floor(Player.getY()) - 1,
                    Math.floor(Player.getZ()),
                ];

                Chat.message(
                    `&aStarting commission: &b${
                        chosenTask.name
                    }&a. Pathing to: &b[${destination.join(', ')}]`
                );

                this.setState(STATES.TRAVELING);
                findAndFollowPath(
                    startPos,
                    destination,
                    false,
                    () => this.onPathComplete(),
                    () => this.onPathFail()
                );
                return;
            }
        }

        // ALL commissions have occupied spots
        if (this.currentState !== STATES.WAITING_FOR_SPOT) {
            const commissionNames = possibleTasks
                .map((t) => t.name)
                .join('&7, &b');
            Chat.message(
                `&cAll spots occupied for: &b${commissionNames}&c. Waiting...`
            );
        }
        this.setState(STATES.WAITING_FOR_SPOT);
    }

    onPathComplete() {
        if (!this.enabled) return;

        Chat.message(
            `&aArrived at destination for &b${
                this.currentCommission?.name || 'Unknown'
            }`
        );
        this.currentCommission = null;
        this.setState(STATES.IDLE);
    }

    onPathFail() {
        if (!this.enabled) return;

        Chat.message(
            `&cFailed to find a path for &b${
                this.currentCommission?.name || 'Unknown'
            }. Retrying...`
        );
        this.currentCommission = null;
        this.setState(STATES.IDLE);
    }

    readCommissions() {
        try {
            const tabItems = TabList.getNames();
            let startIndex = -1;

            for (let i = 0; i < tabItems.length; i++) {
                const cleaned = ChatLib.removeFormatting(
                    tabItems[i] ?? ''
                ).trim();
                if (cleaned === 'Commissions:') {
                    startIndex = i;
                    break;
                }
            }

            if (startIndex === -1) {
                if (this.commissions.length > 0) {
                    this.commissions = [];
                }
                return;
            }

            let endIndex = tabItems.length;
            for (let i = startIndex + 1; i < tabItems.length; i++) {
                const cleaned = ChatLib.removeFormatting(
                    tabItems[i] ?? ''
                ).trim();
                if (cleaned === '' || cleaned === 'Powders:') {
                    endIndex = i;
                    break;
                }
            }

            const newCommissions = [];
            for (let i = startIndex + 1; i < endIndex; i++) {
                const formattedText = ChatLib.removeFormatting(
                    tabItems[i] ?? ''
                ).trim();

                if (!formattedText.includes(':')) continue;

                const parts = formattedText.split(':');
                const name = parts[0].trim();
                const progressStr = parts[1].trim();
                let progress;

                if (progressStr.includes('DONE')) {
                    progress = 1;
                } else if (progressStr.includes('%')) {
                    progress =
                        parseFloat(
                            progressStr.replace(/ /g, '').replace('%', '')
                        ) / 100;
                } else {
                    continue;
                }

                newCommissions.push({ name, progress });
            }

            if (
                JSON.stringify(this.commissions) !==
                JSON.stringify(newCommissions)
            ) {
                this.commissions = newCommissions;

                Chat.message('&a--- Commissions Updated ---');
                this.commissions.forEach((c) => {
                    Chat.message(
                        `&7- &f${c.name}: &b${
                            c.progress === 1
                                ? 'DONE'
                                : (c.progress * 100).toFixed(0) + '%'
                        }`
                    );
                });
            }
        } catch (e) {
            Chat.message('&cError reading commissions: ' + e);
            console.error('Error reading commissions:', e);
            this.commissions = [];
        }
    }

    /**
     * Finds mobs
     *
     * Usage:
     *   findMob('goblin')     - Returns array of Goblins and Weaklings
     *   findMob('icewalker')  - Returns array of Ice Walkers/Glacite Walkers
     *   findMob('treasure')   - Returns array of Treasure Hunters
     *
     * @param {string} type - The type of mob to find ('goblin', 'icewalker', 'treasure')
     * @returns {Array<PlayerMP>} - Array of found mobs
     */
    findMob(type) {
        const mobConfigs = {
            goblin: {
                names: ['Goblin', 'Weakling'],
                checkVisibility: true,
                boundaryCheck: (x, y, z) => {
                    if (y <= 127.0) return false;
                    if (z > 153.0 && x < -157.0) return false;
                    if (z < 148.0 && x > -77.0) return false;
                    return true;
                },
            },
            icewalker: {
                names: ['Ice Walker', 'Glacite Walker'],
                checkVisibility: true,
                boundaryCheck: (x, y, z) =>
                    y >= 127.0 &&
                    y <= 132.0 &&
                    z <= 180.0 &&
                    z >= 147.0 &&
                    x <= 42.0,
            },
            treasure: {
                names: ['Treasuer Hunter'], // MISSPELLED ON PURPOSE (Hypixel typo)
                checkVisibility: false,
                boundaryCheck: (x, y, z) => y >= 200.0 && y <= 210.0,
            },
        };

        const mobType = type.toLowerCase();
        const config = mobConfigs[mobType];

        if (!config) {
            console.error(`Unknown mob type: ${type}`);
            return [];
        }

        return this.getMobs(config);
    }

    getMobs(config) {
        const mobs = [];
        const playerMP = config.checkVisibility ? Player.asPlayerMP() : null;

        World.getAllPlayers().forEach((player) => {
            try {
                const nameObj = player.getName();
                if (!nameObj) return;

                const name = ChatLib.removeFormatting(nameObj);
                const uuid = player.getUUID();

                if (this.mobWhitelist.has(uuid)) return;

                if (!config.names.some((mobName) => name.includes(mobName))) {
                    return;
                }

                if (
                    player.isSpectator() ||
                    player.isInvisible() ||
                    player.isDead()
                ) {
                    return;
                }

                if (config.checkVisibility && !playerMP.canSeeEntity(player)) {
                    return;
                }

                const x = player.getX();
                const y = player.getY();
                const z = player.getZ();

                if (!config.boundaryCheck(x, y, z)) return;

                mobs.push(player);
            } catch (e) {
                // Skip invalid entities
            }
        });

        return mobs;
    }
}

new CommissionMacro();
