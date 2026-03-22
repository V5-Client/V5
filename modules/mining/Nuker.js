import { BP, BlockHitResult, Direction, MCHand, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { NukerUtils } from '../../utils/NukerUtils';
import { PlayerInteractBlockC2S } from '../../utils/Packets';
import { manager } from '../../utils/SkyblockEvents';
import { Executor } from '../../utils/ThreadExecutor';
import { TabListUtils } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';
import { Keybind } from '../../utils/player/Keybinding';
import Render from '../../utils/render/Render';

class NukerClass extends ModuleBase {
    constructor() {
        super({
            name: 'Nuker',
            subcategory: 'Mining',
            description: 'Automatically nukes nearby blocks.',
            tooltip: 'Automatically nukes nearby blocks',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();
        this.setTheme('#e23737');

        this.target = null;
        this.lastMineTick = 0;
        this.tickCounter = 0;
        this.lastChestClick = {};
        this.minedBlocks = new Map();
        this.clickQueue = new Set();
        this.chestClickedThisTick = false;

        this.BLOCK_COOLDOWN = 20;
        this.REQUIRED_ITEMS = ['Drill', 'Gauntlet', 'Pick'];

        this.customBlockList = [];

        this.targetMode = 'Random';
        this.nukeBelow = false;
        this.onGroundOnly = false;
        this.autoChest = false;
        this.usePickaxeAbility = false;
        this.heightLimit = 5;
        this.onGroundDelay = 1;
        this.offGroundDelay = 1;
        this.customReach = 4.5;
        this.abilityFromChat = false;
        this.lastUse = 0;
        this.ABILITY_COOLDOWN_MS = 200000;

        v5Command('nukeit', (ticks = 1) => {
            let block = Player.lookingAt();
            if (block?.getClass() === Block) {
                let pos = [block.getX(), block.getY(), block.getZ()];
                NukerUtils.nuke(pos, ticks);
            }
        });

        v5Command('nukeradd', () => {
            let block = Player.lookingAt();
            if (block?.getClass() === Block) {
                const newBlock = { name: block.type.getName(), id: block.type.getID() };
                if (!this.customBlockList.some((b) => b.id === newBlock.id)) {
                    this.customBlockList.push(newBlock);
                    this.message('Added ' + block.type.getName() + ' to Nuker list.');
                } else {
                    this.message('Block already in Nuker list.');
                }
            } else {
                this.message('Look at a block to add it');
            }
        });

        v5Command('nukerremove', (id) => {
            if (id === undefined) return this.message('Usage: /v5 nuker remove <id>');
            let initialLength = this.customBlockList.length;
            this.customBlockList = this.customBlockList.filter((block) => !(block.id === Number.parseInt(id)));
            if (this.customBlockList.length < initialLength) this.message('Removed block(s).');
        });

        v5Command('nukerlist', () => {
            if (this.customBlockList.length === 0) {
                return this.message('List is currently empty.');
            }

            this.message('&7--- Custom Nuker List ---');
            this.customBlockList.forEach((block, index) => {
                this.message(`&e${index + 1}. &f${block.name} &7(ID: ${block.id})`);
            });
            this.message('&7----------------------');
        });

        v5Command('nukerclear', () => {
            this.customBlockList = [];
            this.message('Cleared Nuker list.');
        });

        this.on('tick', () => {
            this.tickCounter++;

            if (Client.isInGui() && !Client.isInChat()) return;
            if (Client.getKeyBindFromDescription('key.attack')?.isKeyDown() || Client.getMinecraft().options.attackKey?.isPressed()) return;
            if (!this.onGround()) return;

            let delay = Player.asPlayerMP().isOnGround() ? this.onGroundDelay : this.offGroundDelay;
            if (this.tickCounter - this.lastMineTick < delay) return;

            this.lastMineTick = this.tickCounter;
            this.chestClickedThisTick = false;

            if (this.shouldUsePickaxeAbility()) {
                this.usePickaxeAbilityNow();
                return;
            }

            for (const [pos, tick] of this.minedBlocks) {
                if (this.tickCounter - tick > this.BLOCK_COOLDOWN) {
                    this.minedBlocks.delete(pos);
                }
            }

            Executor.execute(() => {
                const target = this.scanForBlock();

                if (target) {
                    const posArr = [target.getX(), target.getY(), target.getZ()];
                    NukerUtils.nukeQueueAdd(posArr, delay);
                    this.target = target;
                    this.minedBlocks.set(this.posToString(target), this.tickCounter);

                    if (['Random', 'Lowest', 'Highest'].includes(this.targetMode)) {
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dz = -1; dz <= 1; dz++) {
                                    const spreadPos = new BP(target.getX() + dx, target.getY() + dy, target.getZ() + dz);
                                    this.minedBlocks.set(this.posToString(spreadPos), this.tickCounter);
                                }
                            }
                        }
                    }
                }
            });
        });

        manager.subscribe('abilityready', () => {
            if (!this.enabled || !this.usePickaxeAbility) return;
            this.abilityFromChat = true;
        });

        manager.subscribe('abilityused', () => {
            if (!this.enabled || !this.usePickaxeAbility) return;
            this.lastUse = Date.now();
            this.abilityFromChat = false;
        });

        this.on('postRenderWorld', () => {
            if (this.target) this.renderRGB([this.target.getX(), this.target.getY(), this.target.getZ()]);
            if (this.chestPos && this.autoChest && this.distance(this.cords(), [this.chestPos.x, this.chestPos.y, this.chestPos.z]).distance <= 8) {
                Render.drawBox(new Vec3d(this.chestPos.x, this.chestPos.y, this.chestPos.z), Render.Color(100, 100, 255, 150), false);
            }
        });

        this.when(
            () => this.enabled && this.autoChest && !(Client.isInGui() && !Client.isInChat()),
            'renderBlockEntity',
            (entity) => {
                if (entity?.getBlockType()?.getID() !== 200) return;
                const chest = entity?.getBlock()?.pos;
                if (!chest) return;
                this.chestPos = chest;
                const posStr = `${chest.x},${chest.y},${chest.z}`;

                if (this.clickQueue.has(posStr)) return;
                if (this.distance(this.cords(), [chest.x, chest.y, chest.z]).distance > 6) return;

                if (!this.chestClickedThisTick && (!this.lastChestClick[posStr] || Date.now() - this.lastChestClick[posStr] > 50)) {
                    this.clickQueue.add(posStr);
                    this.rightClickBlock([chest.x, chest.y, chest.z]);
                    this.lastChestClick[posStr] = Date.now();
                    this.chestClickedThisTick = true;
                }
            }
        );

        this.addToggle('Auto Chest', (v) => (this.autoChest = v), 'Auto-opens chests');
        this.addToggle("Don't nuke below", (v) => (this.nukeBelow = v), 'Prevents nuking below');
        this.addToggle('On Ground Only', (v) => (this.onGroundOnly = v), 'Only mine when on ground');
        this.addToggle('Use Pickaxe Ability', (v) => (this.usePickaxeAbility = v), 'Uses pickaxe ability when available');
        this.addSlider('Custom Reach', '4.5', 6.0, this.customReach, (v) => (this.customReach = Number(v)), 'Adjust player reach');
        this.addSlider('On Ground Delay', 1, 20, 1, (v) => (this.onGroundDelay = v));
        this.addSlider('Off Ground Delay', 1, 20, 1, (v) => (this.offGroundDelay = v));
        this.addMultiToggle('Target Mode', ['Random', 'Closest', 'Lowest', 'Highest'], true, (v) => {
            this.targetMode = v.find((o) => o.enabled)?.name;
        });

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    'Target Mode': () => this.targetMode,
                    'Blocks Queued': () => NukerUtils.nukeQueue.length,
                },
            },
        ]);
    }

    scanForBlock() {
        const pPos = { x: Math.floor(Player.getX()), y: Math.floor(Player.getY()), z: Math.floor(Player.getZ()) };
        const pCords = this.cords();
        const validBlocks = [];
        const scanReach = this.customReach;
        const scanRadius = Math.ceil(scanReach);
        const maxY = pPos.y + Math.max(this.heightLimit, scanRadius);
        const minY = pPos.y - (this.nukeBelow ? 0 : scanRadius);

        for (let x = pPos.x - scanRadius; x <= pPos.x + scanRadius; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = pPos.z - scanRadius; z <= pPos.z + scanRadius; z++) {
                    const posKey = `${x},${y},${z}`;
                    if (this.minedBlocks.has(posKey)) continue;
                    if (this.distanceToBlockBox(pCords, [x, y, z]).distance > scanReach) continue;

                    let blockPos = new BP(x, y, z);
                    const block = World.getBlockAt(x, y, z);
                    if (!block?.type) continue;

                    const id = block.type.getID();
                    const isValid = this.customBlockList.some((b) => b.id === id);

                    if (isValid) validBlocks.push(blockPos);
                }
            }
        }

        if (validBlocks.length === 0) return null;

        if (this.targetMode === 'Closest') {
            return validBlocks.sort(
                (a, b) =>
                    this.distanceToBlockBox(pCords, [a.getX(), a.getY(), a.getZ()]).distance -
                    this.distanceToBlockBox(pCords, [b.getX(), b.getY(), b.getZ()]).distance
            )[0];
        } else if (this.targetMode === 'Lowest') {
            let minY = Math.min(...validBlocks.map((b) => b.getY()));
            let lowest = validBlocks.filter((b) => b.getY() === minY);
            return lowest[Math.floor(Math.random() * lowest.length)];
        } else if (this.targetMode === 'Highest') {
            let maxY = Math.max(...validBlocks.map((b) => b.getY()));
            let highest = validBlocks.filter((b) => b.getY() === maxY);
            return highest[Math.floor(Math.random() * highest.length)];
        }

        return validBlocks[Math.floor(Math.random() * validBlocks.length)];
    }

    isHoldingMiningTool() {
        const heldName = TabListUtils.stripFormatting(Player.getHeldItem()?.getName?.() ?? '');
        return this.REQUIRED_ITEMS.some((name) => heldName.includes(name));
    }

    shouldUsePickaxeAbility() {
        if (!this.usePickaxeAbility) return false;
        if (!this.isHoldingMiningTool()) return false;

        const now = Date.now();
        const abilityStatus = TabListUtils.getPickaxeAbilityStatus();
        return abilityStatus.includes('Available') || this.abilityFromChat || this.lastUse + this.ABILITY_COOLDOWN_MS < now;
    }

    usePickaxeAbilityNow() {
        Keybind.rightClick();
        this.lastUse = Date.now();
        this.abilityFromChat = false;
    }

    posToString(pos) {
        return pos.getX ? `${pos.getX()},${pos.getY()},${pos.getZ()}` : `${pos[0]},${pos[1]},${pos[2]}`;
    }

    distance(from, to) {
        const dx = from[0] - to[0],
            dy = from[1] - to[1],
            dz = from[2] - to[2];
        return { distance: Math.hypot(dx, dy, dz) };
    }

    distanceToBlockBox(from, to) {
        const clampedX = Math.max(to[0], Math.min(from[0], to[0] + 1));
        const clampedY = Math.max(to[1], Math.min(from[1], to[1] + 1));
        const clampedZ = Math.max(to[2], Math.min(from[2], to[2] + 1));
        return this.distance(from, [clampedX, clampedY, clampedZ]);
    }

    onGround() {
        return this.onGroundOnly ? Player.asPlayerMP().isOnGround() : true;
    }

    cords() {
        let eye = Utils.convertToVector(Player.asPlayerMP().getEyePosition(1));
        return [eye.x, eye.y, eye.z];
    }

    renderRGB(loc) {
        let time = Date.now() / 1000;
        let r = Math.sin(time) * 127 + 128,
            g = Math.sin(time + 2) * 127 + 128,
            b = Math.sin(time + 4) * 127 + 128;
        Render.drawWireFrame(new Vec3d(loc[0], loc[1], loc[2]), Render.Color(r, g, b, 255), 5, true);
    }

    rightClickBlock(xyz) {
        let hitResult = new BlockHitResult(new Vec3d(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5), Direction.UP, new BP(xyz[0], xyz[1], xyz[2]), false);
        Client.sendSequencedPacket((sequence) => new PlayerInteractBlockC2S(MCHand.MAIN_HAND, hitResult, sequence));
    }

    init() {
        this.target = null;
        this.lastMineTick = 0;
        this.tickCounter = 0;
        this.minedBlocks.clear();
        this.clickQueue.clear();
        this.abilityFromChat = false;
    }

    onEnable() {
        this.message('&aEnabled');
        this.init();
    }

    onDisable() {
        this.message('&cDisabled');
        this.init();
    }
}

export const Nuker = new NukerClass();
