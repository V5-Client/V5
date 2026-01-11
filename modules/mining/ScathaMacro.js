import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { Rotations } from '../../utils/player/RotationsTest';
import { Keybind } from '../../utils/player/Keybinding';
import { Time } from '../../utils/Timing';
import { Guis } from '../../utils/player/Inventory';
import { MathUtils } from '../../utils/Math';
import { Utils } from '../../utils/Utils';
import { Vec3d, ArmorStandEntity } from '../../utils/Constants';
class ScathaMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Scatha Macro',
            subcategory: 'Mining',
            description: 'Automatically mines and kills Scappas for you',
            tooltip: 'Automatically mines and kills Scappas for you',
            showEnabledToggle: false,
            isMacro: true,
        });

        this.bindToggleKey();

        this.ModuleName = 'Scatha Macro';

        this.STATES = {
            SETUP: 0,
            MINING: 1,
            ROUTING: 2,
            CENTERING: 3,
            KILLING: 4,
            WAITING: 5,
            BACKWARDS: 6,
            TUNNEL: 7,
            MINERAL: 8,
        };

        this.setState(this.STATES.SETUP);

        // Timers
        this.stuckTimer = new Time();
        this.chestTimer = new Time();
        this.menuTimer = new Time();
        this.scathaSpawnTimer = new Time();
        this.centeringTimer = new Time();

        // Flags and counters
        this.centeringStart = true;
        this.pause = false;
        this.pickaxeAbility = true;
        this.close = false;
        this.sorrow = false;
        this.scatha = false;
        this.wormDetected = false;
        this.stuckCounter = 0;
        this.unstuckState = 0;
        this.kills = 0;
        this.decimalZ = 0.5;
        this.normalKilling = true;
        this.gettingMenu = false;
        this.menuState = 0;
        this.tunnel = false;

        // Hotbar slots
        this.tpSlot = -1;
        this.drillSlot = -1;
        this.rodSlot = -1;
        this.daeSlot = -1;

        // Last positions for stuck check
        this.stuckPositions = [];

        // Settings (default values)
        this.menuClickDelay = 750;
        this.pinglessAngles = false;

        // Settings UI
        this.addSlider('Menu Click Delay', 500, 1500, 750, (v) => (this.menuClickDelay = v));
        this.addToggle('Pingless Angles', (v) => (this.pinglessAngles = !!v));

        // Worm spawn message
        this.on('chat', () => {
            this.scathaSpawnTimer.reset();
            this.menuTimer.reset();
            Rotations.rotateToAngles(90, 10.0);
            this.sorrow = false;
            this.pause = true;
            this.setState(this.STATES.KILLING);
            Keybind.stopMovement();
            Keybind.setKey('leftclick', false);
            Keybind.setKey('w', false);
            Chat.messageDebug('Detected Worm. Killing');

            Client.scheduleTask(15, () => {
                if (this.rodSlot !== -1) Guis.setItemSlot(this.rodSlot);
            });

            Client.scheduleTask(30, () => {
                this.findTarget();
                const heat = this.getHeat();
                if (this.scatha || heat <= 90) {
                    // PLACEHOLDER: pet swap (black cat) if available
                    // Keybind.rightClick();
                } else {
                    this.pause = false;
                    return;
                }
            });

            Client.scheduleTask(30, () => {
                this.pause = false;
            });
        }).setCriteria('You hear the sound of something approaching...');

        // Ability ready (Anomalous Desire)
        this.on('chat', () => {
            this.pickaxeAbility = true;
        }).setCriteria('Anomalous Desire is now available!');

        // Reduce stuck counter every 20 seconds
        this.on('step', () => {
            if (this.stuckCounter >= 1) this.stuckCounter--;
        }).setDelay(20);

        // Main macro loop
        this.on('step', () => this.mainLoop()).setFps(5);
    }

    getStateName(val) {
        try {
            return Object.keys(this.STATES).find((k) => this.STATES[k] === val) || String(val);
        } catch (e) {
            return String(val);
        }
    }

    setState(next) {
        const prevName = this.getStateName(this.state);
        const nextName = this.getStateName(next);
        Chat.messageDebug(`State: ${prevName} -> ${nextName}`);
        this.state = next;
    }

    onEnable() {
        this.sendMacroMessage('&aEnabled');
        this.setState(this.STATES.SETUP);
        //Mouse.ungrab();
    }

    onDisable() {
        this.sendMacroMessage('&cDisabled');
        this.centeringStart = true;
        this.pickaxeAbility = true;
        this.pause = false;
        this.sbOpened = false;
        this.stuckCounter = 0;
        this.unstuckState = 0;
        this.kills = 0;
        Rotations.stopRotation();
        Keybind.setKey('leftclick', false);
        //Mouse.regrab();
        Keybind.stopMovement();
    }

    // Main loop handling state machine
    mainLoop() {
        if (!this.enabled) return;
        switch (this.state) {
            case this.STATES.SETUP: {
                if (Client.isInGui() && !Client.isInChat()) return;

                const stand = this.findTarget();
                if (stand) {
                    this.setState(this.STATES.KILLING);
                    return;
                }
                if (this.pause) return;

                this.stuckTimer.reset();

                this.drillSlot = Guis.findItemInHotbar('Drill');
                this.tpSlot = Guis.findItemInHotbar('Aspect of the');
                this.rodSlot = Guis.findItemInHotbar('Rod');
                this.daeSlot = Guis.findItemInHotbar('Daedalus Blade');

                if (this.drillSlot === -1) Chat.message('No Drill found');
                if (this.tpSlot === -1) Chat.message('No AOTV found');
                if (this.rodSlot === -1) Chat.message('No Rod found');
                if (this.daeSlot === -1) Chat.message('No Daedalus Blade found');

                if (this.tpSlot === -1 || this.drillSlot === -1 || this.rodSlot === -1 || this.daeSlot === -1) {
                    this.sendMacroMessage('Missing required items');
                    this.toggle(false);
                    return;
                }

                if (Utils.area() !== 'Crystal Hollows') {
                    this.sendMacroMessage('Not in crystal hollows');
                    this.toggle(false);
                    return;
                }
                if (Player.getY() !== 31) {
                    this.sendMacroMessage('Not on bedrock');
                    this.toggle(false);
                    return;
                }

                if (this.centeringStart) {
                    Keybind.setKey('leftclick', false);
                    this.setState(this.STATES.CENTERING);
                    this.centeringStart = false;
                    return;
                }

                let backwardsTunnel = false;
                for (let offsetX = -96; offsetX <= 4; offsetX++) {
                    const blockAtY = World.getBlockAt(Player.getX() + offsetX, Player.getY(), Player.getZ())?.type?.getRegistryName();
                    const blockAtYPlus1 = World.getBlockAt(Player.getX() + offsetX, Player.getY() + 1, Player.getZ())?.type?.getRegistryName();
                    if ((blockAtY && ['minecraft:stone'].includes(blockAtY)) || (blockAtYPlus1 && ['minecraft:stone'].includes(blockAtYPlus1))) {
                        backwardsTunnel = true;
                        break;
                    }
                }
                if (!backwardsTunnel) {
                    Keybind.stopMovement();
                    this.setState(this.STATES.BACKWARDS);
                    return;
                }

                Keybind.stopMovement();
                Rotations.rotateToAngles(90, Player.getPitch());
                Guis.setItemSlot(this.drillSlot);
                this.setState(this.STATES.MINING);
                break;
            }

            case this.STATES.MINING: {
                if (Client.isInGui() && !Client.isInChat()) return;
                this.normalKilling = true;
                Keybind.setKey('s', false);
                this.ShuffleToBlockCenter();

                if (this.pickaxeAbility && this.scathaSpawnTimer.hasReached(29000)) {
                    this.pickaxeAbility = false;
                    Keybind.setKey('leftclick', false);
                    Client.scheduleTask(3, () => Keybind.rightClick());
                    return;
                }

                if (Player.getPlayer().isCrawling()) {
                    Keybind.stopMovement();
                    Keybind.setKey('shift', true);
                    return;
                } else {
                    Keybind.setKey('shift', false);
                }

                if (this.canClickChest()) {
                    Keybind.setKey('leftclick', false);
                    Keybind.setKey('w', true);
                    Keybind.rightClick();
                    this.chestTimer.reset();
                    return;
                }

                const playerPos = new Vec3d(Player.getX(), Player.getY(), Player.getZ());
                this.stuckPositions.push(playerPos);
                if (this.stuckPositions.length > 10) this.stuckPositions.shift();
                if (this.stuckPositions.some((pos) => pos.getDistance(playerPos) >= 0.5)) this.stuckTimer.reset();

                if (Player.getX() >= 202.2 && Player.getX() <= 202.4) {
                    this.gettingMenu = true;
                    this.menuTimer.reset();
                    this.menuState = 99;
                    this.setState(this.STATES.ROUTING);
                    return;
                }

                if (this.stuckCounter >= 3) Utils.warnPlayer('You are currently stuck!');
                if (this.stuckCounter >= 6) {
                    Utils.warnPlayer('You are currently stuck!');
                    this.toggle(false);
                }

                if (this.stuckTimer.hasReached(2000)) {
                    this.stuckCounter++;
                    Keybind.stopMovement();
                    Keybind.setKey('leftclick', false);
                    Keybind.setKey('s', true);
                    this.setState(this.STATES.CENTERING);
                    Chat.messageDebug('Getting unstuck');
                    return;
                }

                Keybind.setKey('leftclick', true);
                Keybind.setKey('w', true);

                const pane = World.getBlockAt(Player.getX(), Player.getY(), Player.getZ())?.type?.getRegistryName()?.includes('_pane');
                const block = World.getBlockAt(Player.getX() - 1, Player.getY(), Player.getZ())?.type?.getRegistryName();
                const blockaheadName = World.getBlockAt(Player.getX() - 2, Player.getY(), Player.getZ())?.type?.getRegistryName();
                const isSolid = (n) => n && !['minecraft:air', 'minecraft:water', 'minecraft:lava'].includes(n);
                const blocks = isSolid(block) || isSolid(blockaheadName);

                if (this.pinglessAngles) Rotations.rotateToAngles(90, pane ? 70.0 : blocks ? 35.0 : 12.0);
                else Rotations.rotateToAngles(90, pane ? 70.0 : blocks ? 35.0 : 35.0);
                break;
            }

            case this.STATES.ROUTING: {
                Keybind.setKey('leftclick', false);
                if (this.menuState === 99) {
                    this.gettingMenu = true;
                    this.menuState = 0;
                }
                this.tunnel = true;

                if (this.gettingMenu) {
                    if (this.menuState === 0 && this.menuTimer.hasReached(this.menuClickDelay)) {
                        ChatLib.command('hotm');
                        this.menuTimer.reset();
                        this.menuState++;
                        return;
                    }
                    if (
                        this.menuState === 1 &&
                        Player.getContainer()?.getName() == '§rHeart of the Mountain' &&
                        this.menuTimer.hasReached(this.menuClickDelay)
                    ) {
                        const mole = Player.getContainer()?.getStackInSlot(13);
                        if (mole && mole?.type?.getID() === 689) {
                            Guis.clickSlot(13, false, 'RIGHT');
                            this.menuTimer.reset();
                            this.menuState++;
                            return;
                        } else this.menuState++;
                    }
                    if (
                        this.menuState === 2 &&
                        Player.getContainer()?.getName() == '§rHeart of the Mountain' &&
                        this.menuTimer.hasReached(this.menuClickDelay)
                    ) {
                        const efficientMiner = Player.getContainer()?.getStackInSlot(22);
                        if (efficientMiner && efficientMiner?.type?.getID() === 689) {
                            Guis.clickSlot(22, false, 'RIGHT');
                            this.menuTimer.reset();
                            this.menuState++;
                            return;
                        } else this.menuState++;
                    }
                    if (this.menuState === 3) {
                        ChatLib.command('wardrobe');
                        this.menuTimer.reset();
                        this.menuState++;
                        return;
                    }
                    if (this.menuState === 4 && Player.getContainer()?.getName() == '§rWardrobe (1/2)' && this.menuTimer.hasReached(this.menuClickDelay)) {
                        for (let i = 0; i < Player.getContainer().getSize(); i++) {
                            const item = Player.getContainer().getStackInSlot(i);
                            if (!item) continue;
                            const name = item.getName().removeFormatting().toLowerCase();
                            if (name.includes('mineral boots')) {
                                const targetSlot = i + 9;
                                Guis.clickSlot(targetSlot, false, 'LEFT');
                                this.menuTimer.reset();
                                this.menuState++;
                                return;
                            }
                        }
                    }
                    if (this.menuState === 5 && this.menuTimer.hasReached(this.menuClickDelay)) {
                        Guis.closeInv();
                        Client.scheduleTask(5, () => {
                            Rotations.rotateToAngles(90, -75);
                            this.setState(this.STATES.BACKWARDS);
                            this.menuState = 0;
                            this.unstuckState = 1;
                            this.menuTimer.reset();
                        });
                    }
                }
                break;
            }

            case this.STATES.BACKWARDS: {
                if (this.pause) return;
                if (!this.scathaSpawnTimer.hasReached(27000)) {
                    Keybind.stopMovement();
                    this.stuckTimer.reset();
                    Rotations.rotateToAngles(90, -75);
                    return;
                }
                if (!this.scathaSpawnTimer.hasReached(28000)) {
                    if (this.drillSlot !== -1) Guis.setItemSlot(this.drillSlot);
                    Keybind.stopMovement();
                    this.stuckTimer.reset();
                    return;
                }

                if (Player.getX() >= 823.69 && this.stuckTimer.hasReached(1000)) {
                    if (this.menuState === 0 && this.menuTimer.hasReached(this.menuClickDelay)) {
                        ChatLib.command('hotm');
                        this.menuTimer.reset();
                        this.menuState++;
                        return;
                    }
                    if (
                        this.menuState === 1 &&
                        Player.getContainer()?.getName() == '§rHeart of the Mountain' &&
                        this.menuTimer.hasReached(this.menuClickDelay)
                    ) {
                        const mole = Player.getContainer()?.getStackInSlot(13);
                        if (mole && (mole?.type?.getID() === '845' || mole?.type?.getID() === '846')) {
                            Guis.clickSlot(13, false, 'RIGHT');
                            this.menuTimer.reset();
                            this.menuState++;
                            return;
                        } else this.menuState++;
                    }
                    if (
                        this.menuState === 2 &&
                        Player.getContainer()?.getName() == '§rHeart of the Mountain' &&
                        this.menuTimer.hasReached(this.menuClickDelay)
                    ) {
                        const efficientMiner = Player.getContainer()?.getStackInSlot(22);
                        if (efficientMiner && (efficientMiner?.type?.getID() === '845' || efficientMiner?.type?.getID() === '846')) {
                            Guis.clickSlot(22, false, 'RIGHT');
                            this.menuTimer.reset();
                            this.menuState++;
                            return;
                        } else this.menuState++;
                    }
                    if (this.menuState === 3) {
                        ChatLib.command('wardrobe');
                        this.menuTimer.reset();
                        this.menuState++;
                        return;
                    }
                    if (this.menuState === 4 && Player.getContainer()?.getName() == '§rWardrobe (1/2)' && this.menuTimer.hasReached(this.menuClickDelay)) {
                        for (let i = 0; i < Player.getContainer().getSize(); i++) {
                            const item = Player.getContainer().getStackInSlot(i);
                            if (!item) continue;
                            const name = item.getName().removeFormatting().toLowerCase();
                            if (name.includes('sorrow boots') || name.includes('superior dragon boots')) {
                                const targetSlot = i + 9;
                                Guis.clickSlot(targetSlot, false, 'LEFT');
                                this.menuTimer.reset();
                                this.menuState++;
                                return;
                            }
                        }
                    }
                    if (this.menuState === 5 && this.menuTimer.hasReached(this.menuClickDelay)) {
                        Guis.closeInv();
                        this.menuTimer.reset();
                        this.setState(this.STATES.TUNNEL);
                        if (this.drillSlot !== -1) Guis.setItemSlot(this.drillSlot);
                        this.tunnelPos = [Player.getX(), Player.getY(), Player.getZ() + 6];
                        Keybind.setKey('leftclick', false);
                        Keybind.stopMovement();
                        this.tunnel = false;
                        return;
                    }
                }
                if (Client.isInGui() && !Client.isInChat()) return;

                if (this.drillSlot !== -1) Guis.setItemSlot(this.drillSlot);

                if (this.pickaxeAbility) {
                    this.pickaxeAbility = false;
                    Keybind.setKey('leftclick', false);
                    Client.scheduleTask(3, () => Keybind.rightClick());
                    return;
                }
                if (this.canClickChest()) {
                    Keybind.setKey('leftclick', false);
                    Keybind.setKey('w', true);
                    Keybind.rightClick();
                    this.chestTimer.reset();
                    return;
                }

                Keybind.setKey('leftclick', true);
                Keybind.setKey('w', false);

                this.normalKilling = false;

                const playerPos2 = new Vector(Player.getX(), Player.getY(), Player.getZ());
                this.stuckPositions.push(playerPos2);
                if (this.stuckPositions.length > 10) this.stuckPositions.shift();
                if (this.stuckPositions.some((pos) => pos.getDistance(playerPos2) >= 0.5)) this.stuckTimer.reset();

                const isSolidBlock = (name) => name && !['minecraft:air', 'minecraft:water', 'minecraft:lava', 'minecraft:bedrock'].includes(name);
                const paneHere = World.getBlockAt(Player.getX(), Player.getY(), Player.getZ())?.type?.getRegistryName()?.includes('_pane');
                const paneAboveHere = World.getBlockAt(Player.getX(), Player.getY() + 1, Player.getZ())
                    ?.type?.getRegistryName()
                    ?.includes('_pane');
                const blockAt = isSolidBlock(World.getBlockAt(Player.getX() + 1, Player.getY(), Player.getZ())?.type?.getRegistryName());
                const blockAbove = isSolidBlock(World.getBlockAt(Player.getX() + 1, Player.getY() + 1, Player.getZ())?.type?.getRegistryName());
                const blockBehind = isSolidBlock(World.getBlockAt(Player.getX() + 2, Player.getY(), Player.getZ())?.type?.getRegistryName());
                const blockBehindAbove = isSolidBlock(World.getBlockAt(Player.getX() + 2, Player.getY() + 1, Player.getZ())?.type?.getRegistryName());

                this.ShuffleToBlockCenter();

                if (this.stuckCounter >= 3) Utils.warnPlayer('You are currently stuck!');
                if (this.stuckCounter >= 6) {
                    Utils.warnPlayer('You are currently stuck!');
                    this.toggle(false);
                }

                if (this.stuckTimer.hasReached(2000) && Player.getX() <= 823.69) {
                    this.stuckCounter++;
                    Keybind.stopMovement();
                    Keybind.setKey('leftclick', false);
                    Keybind.setKey('s', true);
                    this.setState(this.STATES.CENTERING);
                    Chat.messageDebug('Getting unstuck');
                    return;
                }

                const panes = paneHere || paneAboveHere;
                const blocks = blockAt || blockAbove || blockBehind || blockBehindAbove;

                if (blocks || panes) {
                    Keybind.stopMovement();
                    Rotations.rotateToAngles(-90, paneHere ? 70.0 : 35.0);
                    Rotations.onEndRotation(() => {
                        let foundBlockAhead = false;
                        for (let offsetX = 1; offsetX <= 7; offsetX++) {
                            const blockAtY = World.getBlockAt(Player.getX() + offsetX, Player.getY(), Player.getZ())?.type?.getRegistryName();
                            const blockAtYPlus1 = World.getBlockAt(Player.getX() + offsetX, Player.getY() + 1, Player.getZ())?.type?.getRegistryName();
                            if (
                                (blockAtY && !['minecraft:air', 'minecraft:water', 'minecraft:lava', 'minecraft:bedrock'].includes(blockAtY)) ||
                                (blockAtYPlus1 && !['minecraft:air', 'minecraft:water', 'minecraft:lava', 'minecraft:bedrock'].includes(blockAtYPlus1))
                            ) {
                                foundBlockAhead = true;
                                break;
                            }
                        }
                        if (foundBlockAhead) {
                            Keybind.setKey('w', true);
                            Keybind.setKey('leftclick', true);
                        } else {
                            Keybind.setKey('w', false);
                            Keybind.setKey('leftclick', true);
                        }
                    });
                } else {
                    if (!this.normalKilling) {
                        Keybind.stopMovement();
                        Rotations.rotateToAngles(90, -75);
                        Rotations.onEndRotation(() => {
                            Keybind.setKey('leftclick', true);
                            Keybind.setKey('s', true);
                        });
                    }
                }
                break;
            }

            case this.STATES.TUNNEL: {
                if (Client.isInGui() && !Client.isInChat()) return;
                this.unstuckState = 0;
                if (this.canClickChest()) {
                    Keybind.setKey('leftclick', false);
                    Keybind.setKey('w', true);
                    Keybind.rightClick();
                    this.chestTimer.reset();
                    return;
                }
                if (Player.getZ() > this.tunnelPos[2]) {
                    this.setState(this.STATES.CENTERING);
                    Rotations.rotateToAngles(90, 35);
                    Keybind.stopMovement();
                    Keybind.setKey('leftclick', false);
                    Chat.messageDebug('Back to Mining!');
                    return;
                }
                Rotations.rotateToAngles(0, 60);
                Rotations.onEndRotation(() => {
                    Keybind.setKey('w', true);
                    Keybind.setKey('leftclick', true);
                });
                break;
            }

            case this.STATES.CENTERING: {
                if (Client.isInGui() && !Client.isInChat()) return;
                Keybind.setKey('leftclick', false);
                if (this.tpSlot !== -1) Guis.setItemSlot(this.tpSlot);
                Rotations.rotateToAngles(this.getRoundedYaw(), 85);
                this.centeringTimer.reset();
                Client.scheduleTask(5, () => Keybind.stopMovement());
                Client.scheduleTask(9, () => {
                    Keybind.rightClick();
                    Chat.messageDebug('Centering with AOTV.');
                });
                Client.scheduleTask(18, () => {
                    if (this.unstuckState === 0) this.setState(this.STATES.SETUP);
                    else if (this.unstuckState === 1) this.setState(this.STATES.BACKWARDS);
                    Chat.messageDebug('Finished Centering.');
                });
                this.setState(this.STATES.WAITING);
                break;
            }
            case this.STATES.WAITING: {
                // Failsafe in case scheduled transition is missed
                if (this.centeringTimer.hasReached(2000)) {
                    if (this.unstuckState === 1) this.setState(this.STATES.BACKWARDS);
                    else this.setState(this.STATES.SETUP);
                }
                Keybind.stopMovement();
                Keybind.setKey('leftclick', false);
                break;
            }

            case this.STATES.KILLING: {
                Keybind.stopMovement();
                if (this.pause) return;

                if (!this.normalKilling) {
                    if (this.scatha) {
                        if (!Player.getContainer()?.getName() == '§rWardrobe (1/2)' && this.menuTimer.hasReached(this.menuClickDelay) && !this.sorrow) {
                            ChatLib.command('wardrobe');
                            this.menuTimer.reset();
                            return;
                        }
                        if (Player.getContainer()?.getName() == '§rWardrobe (1/2)' && this.menuTimer.hasReached(this.menuClickDelay) && !this.sorrow) {
                            for (let i = 0; i < Player.getContainer().getSize(); i++) {
                                const item = Player.getContainer().getStackInSlot(i);
                                if (!item) continue;
                                const name = item.getName().removeFormatting().toLowerCase();
                                if (name.includes('sorrow boots') || name.includes('superior dragon boots')) {
                                    const targetSlot = i + 9;
                                    Guis.clickSlot(targetSlot, false, 'LEFT');
                                    this.menuTimer.reset();
                                    this.sorrow = true;
                                    return;
                                }
                            }
                        }
                        if (this.sorrow && this.menuTimer.hasReached(this.menuClickDelay)) Guis.closeInv();
                        if (!this.sorrow) return;
                    }
                }

                const playerX = Player.getX();
                const playerZ = Player.getZ();
                const playerYaw = Player.getYaw();
                Keybind.setKey('w', false);
                Keybind.setKey('s', false);
                if (Client.isInGui() && !Client.isInChat()) return;
                if (this.daeSlot !== -1) Guis.setItemSlot(this.daeSlot);
                let target = this.findTarget();
                if (!target) {
                    if (!this.normalKilling) Keybind.setKey('w', true);
                    if (this.wormDetected) {
                        this.wormDetected = false;
                        Chat.messageDebug('Worm killed!');
                        this.pause = true;
                        this.kills++;
                        Keybind.stopMovement();
                        if (this.normalKilling) {
                            Keybind.setKey('shift', false);
                            this.setState(this.STATES.SETUP);
                        }
                        if (!this.normalKilling) {
                            Keybind.setKey('shift', false);
                            this.setState(this.STATES.MINERAL);
                        }
                        if (this.daeSlot !== -1) Guis.setItemSlot(this.daeSlot);
                        Client.scheduleTask(5, () => {
                            this.pause = false;
                            this.menuTimer.reset();
                        });
                    }
                    return;
                }
                this.wormDetected = true;
                Keybind.leftClick();
                const dx = target.getX() - playerX;
                const dz = target.getZ() - playerZ;
                const yawRad = ((playerYaw + 90) * Math.PI) / 180;
                const forwardX = Math.cos(yawRad);
                const forwardZ = Math.sin(yawRad);
                const forwardDist = dx * forwardX + dz * forwardZ;
                const threshold = 0.01;
                const backthreshold = 2;
                Keybind.setKey('w', false);
                Keybind.setKey('s', false);
                if (this.normalKilling) {
                    if (forwardDist < -threshold) Keybind.setKey('s', true);
                } else {
                    if (this.menuTimer.hasReached(this.menuClickDelay)) {
                        Keybind.setKey('w', false);
                        Keybind.setKey('s', false);
                        if (forwardDist > backthreshold) Keybind.setKey('w', true);
                        else if (forwardDist < -threshold) Keybind.setKey('s', true);
                    }
                }
                break;
            }

            case this.STATES.MINERAL: {
                if (this.pause) return;
                if (!this.scatha) {
                    this.setState(this.STATES.BACKWARDS);
                    return;
                }
                if (this.close && this.menuTimer.hasReached(this.menuClickDelay)) {
                    Guis.closeInv();
                    this.setState(this.STATES.BACKWARDS);
                    this.close = false;
                    this.scatha = false;
                    return;
                }
                if (!Player.getContainer()?.getName() == '§rWardrobe (1/2)' && this.menuTimer.hasReached(this.menuClickDelay)) {
                    ChatLib.command('wardrobe');
                    this.menuTimer.reset();
                    return;
                }
                if (Player.getContainer()?.getName() == '§rWardrobe (1/2)' && this.menuTimer.hasReached(this.menuClickDelay)) {
                    for (let i = 0; i < Player.getContainer().getSize(); i++) {
                        const item = Player.getContainer().getStackInSlot(i);
                        if (!item) continue;
                        const name = item.getName().removeFormatting().toLowerCase();
                        if (name.includes('mineral boots')) {
                            const targetSlot = i + 9;
                            Guis.clickSlot(targetSlot, false, 'LEFT');
                            this.menuTimer.reset();
                            this.close = true;
                            return;
                        }
                    }
                }
                break;
            }
        }
    }

    sendMacroMessage(msg) {
        Chat.message(this.ModuleName + ': ' + msg);
    }

    canClickChest() {
        if (!this.chestTimer.hasReached(130)) return false;
        const object = Player.lookingAt();
        if (object instanceof Block) {
            const id = object.type.getID();
            if (id === 188) return true;
        }
        return false;
    }

    // Safer target finder (formatting-agnostic)
    findTarget() {
        const py = Math.floor(Player.getY());
        const pz = Math.floor(Player.getZ());
        const list = World.getAllEntitiesOfType(ArmorStandEntity);
        const ent =
            list.find((e) => {
                const raw = e.getName?.() || '';
                const name = ChatLib.removeFormatting(raw);
                const ey = Math.floor(e.getY());
                const ez = Math.floor(e.getZ());
                const worm = name.includes('Worm');
                const scatha = name.includes('Scatha');
                const base = e.isInvisible() && Math.abs(ez - pz) <= 1 && ey >= py && ey <= 35;
                if (base && scatha) this.scatha = true;
                return base && (scatha || worm);
            }) || null;
        return ent;
    }

    findTargetStand() {
        const py = Math.floor(Player.getY());
        const pz = Math.floor(Player.getZ());
        const list = World.getAllEntitiesOfType(ArmorStandEntity);
        const ent =
            list.find((e) => {
                const name = e.getName?.() || '';
                const ey = Math.floor(e.getY());
                const ez = Math.floor(e.getZ());
                const worm = name.includes('§8[§7Lv5§8] §cWorm§r');
                const scatha = name.includes('§8[§7Lv10§8] §cScatha§r');
                const base = e.isInvisible() && Math.abs(ez - pz) <= 1 && ey >= py && ey <= 35 && name.includes('❤');
                if (base && scatha) this.scatha = true;
                return base && (scatha || worm);
            }) || null;
        return ent;
    }

    getHeat() {
        let heat = 0;
        try {
            Scoreboard.getLines().forEach((line) => {
                let name = ChatLib.removeFormatting(line.getName());
                if (name.includes('Heat')) {
                    const num = MathUtils.getNumbersFromString(name);
                    if (typeof num === 'number') heat = num;
                }
            });
        } catch (e) {
            Chat.messageDebug('Heat not detected');
        }
        if (heat === undefined || isNaN(heat) || heat === null) {
            Chat.messageDebug('Heat not detected');
            return 0;
        }
        return heat;
    }

    getRoundedYaw() {
        const yaw = Player.getYaw();
        return Math.round(yaw / 90) * 90;
    }

    ShuffleToBlockCenter() {
        this.decimalZ = Player.getZ() % 1;
        if (this.decimalZ < 0.3) {
            Keybind.setKey('shift', true);
            Client.scheduleTask(1, () => Keybind.setKey('a', true));
            Client.scheduleTask(2, () => Keybind.setKey('a', false));
            Client.scheduleTask(3, () => Keybind.setKey('shift', false));
        }
        if (this.decimalZ > 0.7) {
            Keybind.setKey('shift', true);
            Client.scheduleTask(1, () => Keybind.setKey('d', true));
            Client.scheduleTask(2, () => Keybind.setKey('d', false));
            Client.scheduleTask(3, () => Keybind.setKey('shift', false));
        }
    }
}

new ScathaMacro();
