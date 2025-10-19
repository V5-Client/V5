import { Chat } from '../../Utility/Chat';
import { findAndFollowPath, stopPathing } from '../../Pathfinding/PathAPI';
import { COMMISSION_DATA } from './CommissionData';
import { registerEventSB } from '../../Utility/SkyblockEvents';
import { MiningBot } from './MiningBot';
import { MiningUtils } from '../../Utility/MiningUtils';
import { Guis } from '../../Utility/Inventory';
import { ModuleBase } from '../../Utility/ModuleBase';

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    TRAVELING: 'Traveling to Location',
    WAITING_FOR_SPOT: 'Waiting for Spot',
    // TODO: the other states
    // MINING: 'Mining',
    // SLAYER: 'Killing Mobs',
    // SELLING: 'Selling Items',
    // REFUELING: 'Refueling Drill',
    // CLAIMING: 'Claiming Rewards',
    // SWAPPING_PICK: 'Swapping Pickonimbus',
};

class CommissionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Commission Macro',
            subcategory: 'Mining',
            description: 'Completes Commissions for you',
            tooltip:
                'Completes Commissions for you (Dwarven). Use /startcommission and /stopcommission',
            showEnabledToggle: false,
        });
        this.bindToggleKey();
        this.currentState = STATES.IDLE;
        this.playerAvoidanceRadius = 10;

        this.commissions = [];
        this.lastCommissionCheck = 0;
        this.currentCommission = null;
        this.hasWarned = false;
        this.mobWhitelist = new Set();

        // TODO: the other properties
        // this.currentMiningWaypoint = null; // The waypoint it's mining at
        // this.currentSlayerTarget = null; // The mob entity it's targeting
        // this.drill = null; // From MiningUtils.getDrills().drill
        // this.blueCheese = null; // From MiningUtils.getDrills().blueCheese
        // this.pickaxe = null; // For ice walker slayer (same as drill)
        // this.weapon = null; // For goblin slayer (hotbar slot from settings, it can probably be changed later)
        // this.hasRoyalPigeon = false; // Check if Royal Pigeon is in inventory, NO MORE SETTING!!
        // this.miningSpeed = 0; // From MiningUtils.getMiningSpeed()

        register('command', () => {
            this.toggle(true);
        }).setName('startcommission', true);

        register('command', () => {
            this.toggle(false);
        }).setName('stopcommission', true);

        this.on('step', () => {
            if (Date.now() - this.lastCommissionCheck > 5000) {
                this.readCommissions();
                this.lastCommissionCheck = Date.now();
            }
        }).setDelay(1);

        this.on('tick', () => {
            this.runLogic();
        });

        // TODO: Chat event listener for commission completion
        // register('chat', (event) => {
        //     if (!this.enabled) return;
        //     const msg = ChatLib.getChatMessage(event, false);
        //
        //     // Check if message matches commission completion pattern (see below, i think thats correct)
        //     // Messages include: "Commission Complete! Visit the King"
        //     const commissionNames = COMMISSION_DATA.flatMap(d => d.names);
        //     const upperMsg = msg.toUpperCase();
        //
        //     if (commissionNames.some(name => upperMsg.includes(name.toUpperCase())) &&
        //         msg.includes('FINISHED')) {
        //         this.onCommissionComplete();
        //     }
        // });

        // TODO: Add all the event handlers? not sure if its actually needed
        // registerEventSB('fullinventory', () => {
        //     if (this.enabled && this.currentState === STATES.MINING) {
        //         this.onInventoryFull();
        //     }
        // });

        // registerEventSB('emptydrill', () => {
        //     if (this.enabled && this.currentState === STATES.MINING) {
        //         this.onDrillEmpty();
        //     }
        // });

        // registerEventSB('death', () => {
        //     if (this.enabled) {
        //         Chat.message('&cYou died! Stopping macro...');
        //         this.toggle(false);
        //     }
        // });

        // registerEventSB('pickonimbusbroke', () => {
        //     if (this.enabled && this.currentState === STATES.MINING) {
        //         this.onPickonimbusBroke();
        //     }
        // });

        register('worldUnload', () => {
            if (this.enabled) {
                this.toggle(false);
                Chat.message(
                    'Commission Macro: &cDisabled due to world change'
                );
            }
        });

        this.addSlider(
            'Player Avoidance Radius',
            0,
            200,
            10,
            (value) => {
                this.playerAvoidanceRadius = value;
            },
            'How close another player can be to a mining spot before it is considered occupied.'
        );

        // TODO: Weapon slot for goblin
        // addSlider(
        //     'Modules',
        //     'Commission Macro',
        //     'Weapon Slot (Goblin)',
        //     1,
        //     8,
        //     1,
        //     (value) => {
        //         this.goblinWeaponSlot = value;
        //     },
        //     'Hotbar slot with weapon for Goblin Slayer (1-8)',
        //     1
        // );
    }

    onEnable() {
        Chat.message('&aCommission Macro Enabled.');
        this.init();
    }

    onDisable() {
        Chat.message('&cCommission Macro Disabled.');
        stopPathing();
        this.cleanup();
    }

    init() {
        // const drills = MiningUtils.getDrills();
        // this.drill = drills.drill;
        // this.blueCheese = drills.blueCheese;
        //
        // if (!this.drill) {
        //     Chat.message('&cNo drill found in hotbar!');
        //     this.toggle(false);
        //     return;
        // }

        // For ice walker slayer, use pickaxe
        // this.pickaxe = this.drill;

        // this.weapon = this.getWeaponFromSlot();
        // if (!this.weapon && this.hasGoblinSlayerCommission()) {
        //     Chat.message('&cNo weapon found in Goblin Slayer slot!');
        // }

        // this.hasRoyalPigeon = Guis.findItemInInventory('Royal Pigeon') !== -1;

        // this.miningSpeed = MiningUtils.getMiningSpeed('Dwarven Mines');
        // if (!this.miningSpeed || this.miningSpeed === 0) {
        //     Chat.message('&cNo mining speed saved! Run /getminingstats');
        //     this.toggle(false);
        //     return;
        // }

        this.currentState = STATES.IDLE;
        this.commissions = [];
        this.lastCommissionCheck = 0;
        this.currentCommission = null;
        this.hasWarned = false;
        this.mobWhitelist.clear();
    }

    cleanup() {
        this.currentState = STATES.IDLE;
        this.currentCommission = null;
        this.mobWhitelist.clear();

        // Check if MiningBot.enabled and stop it
        // if (MiningBot.enabled) {
        //     MiningBot.toggle(false);
        // }
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
        // TODO: Add logic for MINING state
        // else if (this.currentState === STATES.MINING) {
        //     // MiningBot does the actual mining
        //     // Need to check if we're still at the right spot
        //     // and handle events (inventory full, drill empty, that shit)
        //     // wait for completion via chat
        // }

        // TODO: Add logic for SLAYER state
        // else if (this.currentState === STATES.SLAYER) {
        //     this.runSlayerLogic();
        // }

        // TODO: Add logic for SELLING state
        // else if (this.currentState === STATES.SELLING) {
        //     this.runSellingLogic();
        // }

        // TODO: Add logic for REFUELING state
        // else if (this.currentState === STATES.REFUELING) {
        //     // MiningUtils.doRefueling does the refuel process
        //     // Just wait for callback
        // }

        // TODO: Add logic for CLAIMING state
        // else if (this.currentState === STATES.CLAIMING) {
        //     this.runClaimingLogic();
        // }

        // TODO: Add logic for SWAPPING_PICK state
        // else if (this.currentState === STATES.SWAPPING_PICK) {
        //     this.runSwappingPickLogic();
        // }
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
            .filter((task) => task !== null);

        // TODO: Make SLAYER type commissions work
        // THIS WENT FROM POSSIBLE TO SUPPORTED, SINCE IDGAF ABOUT SLAYER.
        const supportedTasks = possibleTasks.filter(
            (task) => task.type === 'MINING'
        );

        if (supportedTasks.length === 0) {
            if (!this.hasWarned) {
                Chat.message('&eNo supported commissions available.');
                this.hasWarned = true;
            }
            this.setState(STATES.IDLE);
            return;
        }

        this.hasWarned = false;

        supportedTasks.sort((a, b) => a.cost - b.cost);

        const otherPlayers =
            this.playerAvoidanceRadius > 0
                ? World.getAllPlayers().filter(
                      (p) => p.getName() !== Player.getName()
                  )
                : [];

        // Test each commission in order of lowest cost to highest
        for (let i = 0; i < supportedTasks.length; i++) {
            const chosenTask = supportedTasks[i];

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
            const commissionNames = supportedTasks
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

        // TODO: Do the task at the location.
        // if (this.currentCommission.type === 'MINING') {
        //     this.setState(STATES.MINING);
        //     this.startMining();
        // } else if (this.currentCommission.type === 'SLAYER') {
        //     this.setState(STATES.SLAYER);
        //     this.startSlayer();
        // }

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

    // TODO: Implement mining logic
    // startMining() {
    //     Chat.message('&aStarting mining...');
    //
    //     // Equip drill
    //     Guis.setItemSlot(this.drill.slot);
    //
    //     // NOTE: MiningBot probably will change, this usage is 95% wrong anyway.
    //
    //     // Set cost type based on commission type
    //     let costType;
    //     if (this.currentCommission.name.includes('Titanium') ||
    //         this.currentCommission.name.includes('Mithril')) {
    //         costType = MiningBot.mithrilCosts;
    //     }
    //
    //     if (costType) {
    //         MiningBot.setCost(costType);
    //     }
    //
    //     if (!MiningBot.enabled) {
    //         MiningBot.toggle(true);
    //     }
    // }

    // TODO: Implement slayer logic
    // startSlayer() {
    //     Chat.message('&aStarting slayer...');
    //
    //     // Determine slayer type and equip item
    //     if (this.currentCommission.name.includes('Goblin')) {
    //         Guis.setItemSlot(this.weapon.slot);
    //     } else if (this.currentCommission.name.includes('Glacite Walker') ||
    //                this.currentCommission.name.includes('Ice Walker')) {
    //         Guis.setItemSlot(this.pickaxe.slot);
    //     } else if (this.currentCommission.name.includes('Treasure Hoarder')) {
    //         Guis.setItemSlot(this.pickaxe.slot);
    //     }
    // }

    // TODO: Implement slayer tick logic
    // runSlayerLogic() {
    //     let mobType;
    //     if (this.currentCommission.name.includes('Goblin')) {
    //         mobType = 'goblin';
    //     } else if (this.currentCommission.name.includes('Walker')) {
    //         mobType = 'icewalker';
    //     } else if (this.currentCommission.name.includes('Treasure')) {
    //         mobType = 'treasure';
    //     }
    //
    //     const mobs = this.findMob(mobType);
    //
    //     if (mobs.length === 0) {
    //         // No mobs found, wait
    //         return;
    //     }
    //
    //     const closest = this.getClosestMob(mobs);
    //
    //     // Target and attack
    //     // TODO: Implement rotation, movement, and attacking
    //     // Pretty much the same as the original 1.8.9 ig
    // }

    // TODO: Implement commission completion handler
    // onCommissionComplete() {
    //     Chat.message('&aCommission complete detected!');
    //     stopPathing();
    //
    //     // Stop MiningBot if it's running
    //     if (MiningBot.enabled) {
    //         MiningBot.toggle(false);
    //     }
    //
    //     // Check if royal pigeon
    //     if (this.hasRoyalPigeon) {
    //         this.claimWithPigeon();
    //     } else {
    //         // Need to walk to NPC
    //         this.setState(STATES.CLAIMING);
    //         this.pathToCommissionNPC();
    //     }
    // }

    // TODO: Implement pigeon claim
    // claimWithPigeon() {
    //     const pigeonSlot = Guis.findItemInHotbar('Royal Pigeon');
    //     if (pigeonSlot === -1) {
    //         // Pigeon not in hotbar, try to find in inventory
    //         Chat.message('&cRoyal Pigeon not in hotbar!');
    //         this.pathToCommissionNPC();
    //         return;
    //     }
    //
    //     Guis.setItemSlot(pigeonSlot);
    //     setTimeout(() => {
    //         // Run claim logic
    //         this.setState(STATES.CLAIMING);
    //     }, 100);
    // }

    // TODO: Implement claiming logic
    // pathToCommissionNPC() {
    //     const npcPos = [42, 134, 22]; // Commission NPC at forge, this is NOT the block under, see below for the reasoning:
    //     const startPos = [
    //         Math.floor(Player.getX()),
    //         Math.floor(Player.getY()) - 1,
    //         Math.floor(Player.getZ()),
    //     ];
    //
    //     findAndFollowPath(
    //         startPos,
    //         npcPos,
    //         false,
    //         () => this.onArrivedAtCommissionNPC(),
    //         () => {
    //             Chat.message('&cFailed to path to Commission NPC');
    //             this.setState(STATES.IDLE);
    //         }
    //     );
    // }

    // TODO: Implement NPC interaction
    // onArrivedAtCommissionNPC() {
    //     // Look for NPC entity near [42, 134, 22]
    //     // Rotate to NPC and right click
    //     // Wait for menu to open
    //     this.setState(STATES.CLAIMING);
    // }

    // TODO: Implement claiming tick logic
    // runClaimingLogic() {
    //     const guiName = Guis.guiName();
    //
    //     if (guiName !== 'Commissions') {
    //         // Menu not open yet, wait
    //         return;
    //     }
    //
    //     // check slots 9-17 for COMPLETED commissions
    //     const container = Player.getContainer();
    //     let foundCompleted = false;
    //
    //     for (let i = 9; i < 17; i++) {
    //         const stack = container.getStackInSlot(i);
    //         if (!stack) continue;
    //
    //         const lore = stack.getLore();
    //         const hasCompleted = lore.some(line =>
    //             line.toString().includes('COMPLETED')
    //         );
    //
    //         if (hasCompleted) {
    //             Guis.clickSlot(i, false);
    //             foundCompleted = true;
    //             return; // Wait for next tick to continue
    //         }
    //     }
    //
    //     if (!foundCompleted) {
    //         Guis.closeInv();
    //         this.setState(STATES.IDLE);
    //     }
    // }

    // TODO: Implement inventory full handler
    // onInventoryFull() {
    //     Chat.message('&eInventory full! Selling items...');
    //
    //     if (MiningBot.enabled) {
    //         MiningBot.toggle(false);
    //     }
    //
    //     this.savedState = {
    //         commission: this.currentCommission,
    //         waypoint: this.currentMiningWaypoint,
    //         previousState: this.currentState
    //     };
    //
    //     this.setState(STATES.SELLING);
    //     this.pathToTradesNPC();
    // }

    // TODO: Implement selling logic
    // pathToTradesNPC() {
    //     ChatLib.command('trades');
    //
    //     // shouldn't the guiName check be out here? eh who cares.
    //     setTimeout(() => {
    //         this.runSellingLogic();
    //     }, 500);
    // }

    // TODO: Implement selling tick logic
    // runSellingLogic() {
    //     const guiName = Guis.guiName();
    //
    //     if (guiName !== 'Trades') {
    //         return;
    //     }
    //
    //     const trashItems = ['Mithril', 'Titanium', 'Rune', 'Glacite',
    //                         'Goblin', 'Cobblestone', 'Stone'];
    //
    //     const container = Player.getContainer();
    //     const items = container.getItems();
    //     let foundTrash = false;
    //
    //     for (let i = 54; i < items.length; i++) { // slots 54+ = inventory
    //         const item = items[i];
    //         if (!item) continue;
    //
    //         const name = ChatLib.removeFormatting(item.getName());
    //         const isTrash = trashItems.some(trash => name.includes(trash));
    //         const isNotEquipment = !name.includes('Drill') &&
    //                                 !name.includes('Pickaxe') &&
    //                                 !name.includes('Minecart');
    //
    //         if (isTrash && isNotEquipment) {
    //             Guis.clickSlot(i, false);
    //             foundTrash = true;
    //             return; // Wait for next tick
    //         }
    //     }
    //
    //     if (!foundTrash) {
    //         Guis.closeInv();
    //
    //         if (this.savedState) {
    //             this.currentCommission = this.savedState.commission;
    //             this.currentMiningWaypoint = this.savedState.waypoint;
    //             this.setState(this.savedState.previousState);
    //
    //             if (this.savedState.previousState === STATES.MINING) {
    //                 this.startMining();
    //             }
    //
    //             this.savedState = null;
    //         } else {
    //             this.setState(STATES.IDLE);
    //         }
    //     }
    // }

    // TODO: Implement drill empty
    // onDrillEmpty() {
    //     Chat.message('&eDrill empty! Refueling...');
    //
    //     if (MiningBot.enabled) {
    //         MiningBot.toggle(false);
    //     }
    //
    //     this.setState(STATES.REFUELING);
    //
    //     MiningUtils.doRefueling(true, (success) => {
    //         if (!success) {
    //             Chat.message('&cRefueling failed! No fuel found.');
    //             this.toggle(false);
    //             return;
    //         }
    //
    //         Chat.message('&aRefueling successful!');
    //
    //         const drills = MiningUtils.getDrills();
    //         this.drill = drills.drill;
    //         this.blueCheese = drills.blueCheese;
    //
    //         this.setState(STATES.IDLE);
    //     });
    // }

    // TODO: Implement pickonimbus swap
    // onPickonimbusBroke() {
    //     Chat.message('&ePickonimbus durability low! Swapping...');
    //
    //     if (MiningBot.enabled) {
    //         MiningBot.toggle(false);
    //     }
    //
    //     this.setState(STATES.SWAPPING_PICK);
    //     this.swapPickaxeStep = 0; // Track which step we're on
    // }

    // TODO: Implement pickonimbus swap logic
    // runSwappingPickLogic() {
    //     if (this.swapPickaxeStep === 0) {
    //         // mc.displayGuiScreen(new GuiInventory(Player.getPlayer())) // smth about that is commented so idk, i honestly dont know how this works and cant be assed learning
    //         this.swapPickaxeStep = 1;
    //         return;
    //     }
    //
    //     if (this.swapPickaxeStep === 1) {
    //         const container = Player.getContainer();
    //         let pickSlot = -1;
    //
    //         for (let i = 9; i < container.getSize(); i++) {
    //             const item = container.getStackInSlot(i);
    //             if (!item) continue;
    //
    //             const name = item.getName();
    //             if (name.includes('Pickonimbus') && name.includes('2000')) {
    //                 pickSlot = i;
    //                 break;
    //             }
    //         }
    //
    //         if (pickSlot === -1) {
    //             Chat.message('&cNo fresh Pickonimbus found!');
    //             Guis.closeInv();
    //             this.toggle(false);
    //             return;
    //         }
    //
    //         Guis.clickSlot(pickSlot, true); // Shift click
    //         this.swapPickaxeStep = 2;
    //         return;
    //     }
    //
    //     if (this.swapPickaxeStep === 2) {
    //         Guis.closeInv();
    //
    //         const drills = MiningUtils.getDrills();
    //         this.drill = drills.drill;
    //         this.pickaxe = this.drill;
    //
    //         this.setState(STATES.MINING);
    //         this.startMining();
    //     }
    // }

    // TODO: Add helper method to get closest mob
    // getClosestMob(mobs) {
    //     let closest = null;
    //     let closestDist = Infinity;
    //
    //     mobs.forEach(mob => {
    //         const dist = Math.hypot(
    //             Player.getX() - mob.getX(),
    //             Player.getY() - mob.getY(),
    //             Player.getZ() - mob.getZ()
    //         );
    //
    //         if (dist < closestDist) {
    //             closest = mob;
    //             closestDist = dist;
    //         }
    //     });
    //
    //     return closest;
    // }

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
