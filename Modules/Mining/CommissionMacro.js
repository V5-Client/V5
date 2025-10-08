import { Chat } from '../../Utility/Chat';
const { addToggle, addCategoryItem } = global.Categories;

class CommissionMacro {
    constructor() {
        this.enabled = false;
        this.commissions = [];
        this.lastCommissionCheck = 0;
        this.hasWarned = false;
        this.mobWhitelist = new Set(); // UUIDs of dead mobs (to ignore)

        this.commissionNames = [
            'Royal Mines Titanium',
            'Royal Mines Mithril',
            'Goblin Slayer',
            'Glacite Walker Slayer',
            'Lava Springs Mithril',
            'Lava Springs Titanium',
            "Rampart's Quarry Titanium",
            "Rampart's Quarry Mithril",
            'Titanium Miner',
            'Mithril Miner',
            'Upper Mines Titanium',
            'Upper Mines Mithril',
            'Cliffside Veins Mithril',
            'Cliffside Veins Titanium',
            'Treasure Hoarder Puncher',
        ];

        this.mainLoop = register('step', () => {
            if (Date.now() - this.lastCommissionCheck > 5000) {
                this.readCommissions();
                this.lastCommissionCheck = Date.now();
            }
        }).unregister();

        this.toggle = (value) => {
            this.enabled = value;
            if (value) {
                this.mainLoop.register();
            } else {
                this.mainLoop.unregister();
            }
        };

        this.toggle(this.enabled);

        addCategoryItem(
            'Mining',
            'Commission Macro',
            'Completes Commissions for you',
            'Completes Commissions for you (Dwarven)'
        );

        addToggle(
            'Modules',
            'Commission Macro',
            'Enabled',
            (value) => {
                this.toggle(value);
            },
            'Toggles the Commission Macro module'
        );
    }

    readCommissions() {
        try {
            const tabItems = TabList.getNames();
            let startIndex = -1;

            for (let i = 0; i < tabItems.length; i++) {
                const item = tabItems[i];
                if (!item) continue;

                const cleaned = ChatLib.removeFormatting(item).trim();

                if (cleaned === 'Commissions:') {
                    startIndex = i;
                    break;
                }
            }

            if (startIndex === -1) {
                if (this.commissions.length > 0) this.commissions = [];
                if (!this.hasWarned) {
                    Chat.message(
                        '&cCould not find "Commissions:" in tab list. Make sure you are in the Dwarven Mines.'
                    );
                    this.hasWarned = true;
                }
                return;
            }
            this.hasWarned = false;

            let endIndex = tabItems.length;
            for (let i = startIndex + 1; i < tabItems.length; i++) {
                const item = tabItems[i];
                if (!item) {
                    endIndex = i;
                    break;
                }

                const cleaned = ChatLib.removeFormatting(item).trim();
                if (cleaned === '' || cleaned === 'Powders:') {
                    endIndex = i;
                    break;
                }
            }

            const commissions = [];
            for (let i = startIndex + 1; i < endIndex; i++) {
                const commissionText = tabItems[i];
                if (!commissionText) continue;

                const formattedText =
                    ChatLib.removeFormatting(commissionText).trim();
                if (!formattedText || formattedText === '') continue;

                if (formattedText.includes(':')) {
                    const parts = formattedText.split(':');
                    const name = parts[0].trim();
                    const progressStr = parts[1].trim();

                    if (
                        progressStr.includes('%') ||
                        progressStr.includes('DONE')
                    ) {
                        let progress;
                        if (progressStr.includes('DONE')) {
                            progress = 1;
                        } else {
                            progress =
                                parseFloat(
                                    progressStr
                                        .replace(/ /g, '')
                                        .replace('%', '')
                                ) / 100;
                        }

                        commissions.push({ name, progress });
                    }
                }
            }

            if (
                JSON.stringify(this.commissions) !== JSON.stringify(commissions)
            ) {
                this.commissions = commissions;
                if (this.commissions.length > 0) {
                    Chat.message('&a--- Commissions ---');
                    this.commissions.forEach((c) => {
                        Chat.message(
                            `&7- &f${c.name}: &b${
                                c.progress === 1
                                    ? 'DONE'
                                    : (c.progress * 100).toFixed(2) + '%'
                            }`
                        );
                    });
                } else {
                    Chat.message('&aNo active commissions found.');
                }
            }
        } catch (e) {
            Chat.message('Error reading commissions: ' + e);
            console.log('Error reading commissions: ' + e);
            this.commissions = [];
        }
    }

    /**
     * Finds mob :D
     *
     * Usage:
     *   findMob('goblin')     - Returns array of Goblins and Weaklings
     *   findMob('icewalker')  - Returns array of Ice Walkers/Glacite Walkers
     *   findMob('treasure')    - Returns array of Treasure Hunters ("Treasuer Hunter" typo cuz hypixel is stupid)
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
                names: ['Treasuer Hunter'], // MISSPELLED ON PURPOSE, DO NOT CHANGE.
                checkVisibility: false,
                boundaryCheck: (x, y, z) => y >= 200.0 && y <= 210.0,
            },
        };

        const mobType = type.toLowerCase();
        let config = mobConfigs[mobType];

        if (!config) {
            console.log(`Unknown mob type: ${type}`);
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

                if (!config.names.some((mobName) => name.includes(mobName)))
                    return;

                if (
                    player.isSpectator() ||
                    player.isInvisible() ||
                    player.isDead()
                )
                    return;

                if (config.checkVisibility && !playerMP.canSeeEntity(player))
                    return;

                const x = player.getX();
                const y = player.getY();
                const z = player.getZ();

                if (!config.boundaryCheck(x, y, z)) return;

                mobs.push(player);
            } catch (e) {
                // skip invalid
            }
        });

        return mobs;
    }
}

new CommissionMacro();
