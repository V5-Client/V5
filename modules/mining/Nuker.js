import { BP, BlockHitResult, Direction, MCHand, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { NukerUtils } from '../../utils/NukerUtils';
import { ServerboundUseItemOnPacket } from '../../utils/Packets';
import { manager } from '../../utils/SkyblockEvents';
import { Executor } from '../../utils/ThreadExecutor';
import { TabListUtils } from '../../utils/TabListUtils';
import { v5Command } from '../../utils/V5Commands';
import { Keybind } from '../../utils/player/Keybinding';

class NukerClass extends ModuleBase {
    constructor() {
        super({
            name: 'Nuker',
            subcategory: 'Mining',
            description: 'Automatically nukes nearby blocks.',
            tooltip: 'Automatically nukes nearby blocks',
            theme: '#e23737',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.target = null;
        this.lastMineTick = 0;
        this.tickCounter = 0;
        this.minedBlocks = new Map();
        this.chestClickCooldowns = new Map();
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

        v5Command('nuker add', () => {
            let block = Player.lookingAt();
            if (block?.getClass() === Block) {
                const newBlock = { name: block.type.getName(), registryName: block.type.getRegistryName() };
                if (!this.customBlockList.some((b) => b.registryName === newBlock.registryName)) {
                    this.customBlockList.push(newBlock);
                    this.message('Added ' + block.type.getName() + ' to Nuker list.');
                } else {
                    this.message('Block already in Nuker list.');
                }
            } else {
                this.message('Look at a block to add it');
            }
        });

        v5Command(
            'nuker remove',
            (index) => {
                if (index === undefined) return this.message('Usage: /v5 nuker remove <index>');
                if (index < 1 || index > this.customBlockList.length) return this.message('Invalid index.');
                this.customBlockList.splice(index - 1, 1);
                this.message('Removed block.');
            },
            ['integer']
        );

        v5Command('nuker list', () => {
            if (this.customBlockList.length === 0) {
                return this.message('List is currently empty.');
            }

            this.message('&7--- Custom Nuker List ---');
            this.customBlockList.forEach((block, index) => {
                this.message(`&e${index + 1}. &f${block.name}`);
            });
            this.message('&7----------------------');
        });

        v5Command('nuker clear', () => {
            this.customBlockList = [];
            this.message('Cleared Nuker list.');
        });

        this.on('tick', () => {
            this.tickCounter++;

            const now = Date.now();
            for (const [posStr, clickedAt] of this.chestClickCooldowns) {
                if (now - clickedAt >= 1000) this.chestClickCooldowns.delete(posStr);
            }

            if (this.customBlockList.length === 0) {
                this.message('Try setting targets with /v5 commands:');
                this.message('- /v5 nuker add - adds block at crosshair');
                this.message('- /v5 nuker remove <index> - removes block by list index');
                this.message('- /v5 nuker clear - clear all targets');
                this.message('- /v5 nuker list - list all targets');
                return;
            }

            if (Client.isInGui() && !Client.isInChat()) return;
            if (Client.getKeyBindFromDescription('key.attack')?.isKeyDown() || Client.getMinecraft().options.keyAttack?.isDown()) return;
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
                RenderUtils.drawFilledBox(new Vec3d(this.chestPos.x, this.chestPos.y, this.chestPos.z), new RenderColor(100, 100, 255, 150), false);
            }
        });

        this.when(
            () => this.enabled && this.autoChest && !(Client.isInGui() && !Client.isInChat()),
            'renderBlockEntity',
            (entity) => {
                if (entity?.getBlockType?.()?.getRegistryName?.() !== 'minecraft:chest') return;
                const chest = { x: entity.getX(), y: entity.getY(), z: entity.getZ() };
                this.chestPos = chest;
                const posStr = `${chest.x},${chest.y},${chest.z}`;

                if (this.distance(this.cords(), [chest.x, chest.y, chest.z]).distance > 6) return;

                const now = Date.now();
                if (!this.chestClickedThisTick && now - (this.chestClickCooldowns.get(posStr) ?? 0) >= 1000) {
                    this.rightClickBlock([chest.x, chest.y, chest.z]);
                    this.chestClickCooldowns.set(posStr, now);
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

        const targetTypes = this.customBlockList.map((b) => new BlockType(b.registryName));

        const blocks = World.getBlocksInBox(pPos.x - scanRadius, minY, pPos.z - scanRadius, pPos.x + scanRadius, maxY, pPos.z + scanRadius, targetTypes);
        for (const block of blocks) {
            const posKey = `${block.x},${block.y},${block.z}`;
            if (this.minedBlocks.has(posKey)) continue;
            if (this.distanceToBlockBox(pCords, [block.x, block.y, block.z]).distance > scanReach) continue;

            validBlocks.push(new BP(block.x, block.y, block.z));
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
        if (!from || !to) return { distance: Infinity };
        const dx = from[0] - to[0],
            dy = from[1] - to[1],
            dz = from[2] - to[2];
        return { distance: Math.hypot(dx, dy, dz) };
    }

    distanceToBlockBox(from, to) {
        if (!from || !to) return { distance: Infinity };
        const clampedX = Math.max(to[0], Math.min(from[0], to[0] + 1));
        const clampedY = Math.max(to[1], Math.min(from[1], to[1] + 1));
        const clampedZ = Math.max(to[2], Math.min(from[2], to[2] + 1));
        return this.distance(from, [clampedX, clampedY, clampedZ]);
    }

    onGround() {
        return this.onGroundOnly ? Player.asPlayerMP().isOnGround() : true;
    }

    cords() {
        const eye = Player.getPlayer()?.getEyePosition();
        return eye ? [eye.x(), eye.y(), eye.z()] : null;
    }

    renderRGB(loc) {
        let time = Date.now() / 1000;
        let r = Math.sin(time) * 127 + 128,
            g = Math.sin(time + 2) * 127 + 128,
            b = Math.sin(time + 4) * 127 + 128;
        RenderUtils.drawWireFrameBox(new Vec3d(loc[0], loc[1], loc[2]), new RenderColor(r, g, b, 255), 5, true);
    }

    rightClickBlock(xyz) {
        let hitResult = new BlockHitResult(new Vec3d(xyz[0] + 0.5, xyz[1] + 0.5, xyz[2] + 0.5), Direction.UP, new BP(xyz[0], xyz[1], xyz[2]), false);
        Client.sendSequencedPacket((sequence) => new ServerboundUseItemOnPacket(MCHand.MAIN_HAND, hitResult, sequence));
    }

    init() {
        this.target = null;
        this.lastMineTick = 0;
        this.tickCounter = 0;
        this.minedBlocks.clear();
        this.chestClickCooldowns.clear();
        this.abilityFromChat = false;
    }

    onEnable() {
        this.message('&aEnabled');
        this.init();
    }

    onDisable() {
        this.message('&cDisabled');
    }
}

export const Nuker = new NukerClass();
