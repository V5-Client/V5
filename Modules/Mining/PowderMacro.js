import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { registerEventSB } from '../../utils/SkyblockEvents';
class PowderMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Powder Macro',
            description: 'Powder Macro',
            subcategory: 'Mining',
            hideEnabledButton: true,
        });
        this.bindToggleKey();

        this.height = 8;
        this.width = 12;
        this.speed = 4;
        this.compression = 0.4;
        this.maxPitch = 75;
        this.pivot = { yaw: 0, pitch: 0 };
        this.startTime = 0;
        this.chest = false;
        this.targetChest = null;
        this.savedRotation = null;
        this.returning = false;

        this.addSlider('Height (Pitch)', 1, 30, 8, (v) => (this.height = v), 'Vertical size of the loop');
        this.addSlider('Width (Yaw)', 1, 30, 12, (v) => (this.width = v), 'Horizontal size of the loop');
        this.addSlider('Speed', 1, 20, 4, (v) => (this.speed = v), 'Speed of the loop');
        this.addSlider('Top Compression', 0.1, 1.0, 0.4, (v) => (this.compression = v), 'How much to compress the top half of the circle');
        this.addSlider('Max Pitch', 45, 90, 75, (v) => (this.maxPitch = v), 'Maximum pitch (look down angle) to prevent breaking floor');

        registerEventSB('chestspawn', () => {
            if (!this.chest) {
                this.savedRotation = { yaw: Player.getYaw(), pitch: Player.getPitch() };
                this.chest = true;
                this.targetChest = null;
            }
        });
        registerEventSB('chestopen', () => {
            if (!this.enabled) return;
            this.chest = false;
            this.returning = true;
            this.targetChest = null;
            Rotations.stopRotation();
            if (!Keybind.isKeyDown('shift')) Keybind.setKey('shift', true);
            if (!Keybind.isKeyDown('leftclick')) Keybind.setKey('leftclick', true);
        });
    }

    onEnable() {
        Keybind.setKey('leftclick', true);
        Keybind.setKey('shift', true);

        this.pivot = {
            yaw: Player.getYaw(),
            pitch: Player.getPitch(),
        };
        this.startTime = Date.now();
        global.macrostate.setMacroRunning(true, 'POWDERMACRO');
        Chat.message('Powder Macro Enabled!');
        this.rotateLoop();
    }

    onDisable() {
        Keybind.setKey('leftclick', false);
        Keybind.setKey('shift', false);
        global.macrostate.setMacroRunning(false, 'POWDERMACRO');
        Chat.message('Powder Macro Disabled!');
    }

    onChest() {
        Keybind.setKey('leftclick', false);
        Keybind.setKey('shift', false);

        if (this.targetChest) {
            const currentBlock = World.getBlockAt(this.targetChest.getX(), this.targetChest.getY(), this.targetChest.getZ());
            const name = currentBlock ? currentBlock.getType().getName() : 'Air';
            const isChest =
                currentBlock && (currentBlock.getType().getID() === 54 || currentBlock.getType().getID() === 146 || name.toLowerCase().includes('chest'));

            if (!isChest) {
                this.targetChest = null;
            }
        }

        if (!this.targetChest) {
            let chests = [];
            const pX = Math.floor(Player.getX());
            const pY = Math.floor(Player.getY());
            const pZ = Math.floor(Player.getZ());
            const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

            for (let x = -3; x <= 3; x++) {
                for (let y = -3; y <= 3; y++) {
                    for (let z = -3; z <= 3; z++) {
                        const block = World.getBlockAt(pX + x, pY + y, pZ + z);
                        const name = block ? block.getType().getName() : 'Air';

                        if (block && (block.getType().getID() === 54 || block.getType().getID() === 146 || name.toLowerCase().includes('chest'))) {
                            chests.push({
                                block: block,
                                dist: Math.sqrt(
                                    Math.pow(block.getX() - playerPos.x, 2) + Math.pow(block.getY() - playerPos.y, 2) + Math.pow(block.getZ() - playerPos.z, 2)
                                ),
                            });
                        }
                    }
                }
            }

            if (chests.length > 0) {
                chests.sort((a, b) => a.dist - b.dist);
                this.targetChest = chests[0].block;
            }
        }

        if (this.targetChest) {
            const target = {
                x: this.targetChest.getX() + 0.5,
                y: this.targetChest.getY() + 0.5,
                z: this.targetChest.getZ() + 0.5,
            };

            if (
                !Rotations.targetVector ||
                Math.abs(Rotations.targetVector.x - target.x) > 0.05 ||
                Math.abs(Rotations.targetVector.y - target.y) > 0.05 ||
                Math.abs(Rotations.targetVector.z - target.z) > 0.05
            ) {
                Rotations.rotateToVector(target);
            }
        }

        setTimeout(() => this.rotateLoop(), 10);
    }

    rotateLoop() {
        try {
            if (!this.enabled) return;
            if (this.chest) return this.onChest();

            if (this.returning) {
                const currentYaw = Player.getYaw();
                const currentPitch = Player.getPitch();
                const targetYaw = this.savedRotation ? this.savedRotation.yaw : this.pivot.yaw;
                const targetPitch = this.savedRotation ? this.savedRotation.pitch : this.pivot.pitch;

                const diffYaw = Rotations.normalizeAngle(targetYaw - currentYaw);
                const diffPitch = targetPitch - currentPitch;

                const dist = Math.sqrt(diffYaw * diffYaw + diffPitch * diffPitch);

                if (dist < 2.0) {
                    this.returning = false;
                    const dYaw = currentYaw - this.pivot.yaw;
                    let dPitch = currentPitch - this.pivot.pitch;

                    if (dPitch < 0 && this.compression !== 0) dPitch /= this.compression;
                    const normX = dYaw / this.width;
                    const normY = dPitch / this.height;
                    const currentAngle = Math.atan2(normY, normX);
                    this.startTime = Date.now() - (currentAngle / this.speed) * 1000;
                } else {
                    const speed = 0.15;
                    const newYaw = currentYaw + diffYaw * speed;
                    const newPitch = currentPitch + diffPitch * speed;

                    Rotations.applyRotationWithGCD(newYaw, newPitch);
                    setTimeout(() => this.rotateLoop(), 10);
                    return;
                }
            }

            const time = (Date.now() - this.startTime) / 1000;
            const angle = time * this.speed;

            const dYaw = Math.cos(angle) * this.width;
            let dPitch = Math.sin(angle) * this.height;

            if (dPitch < 0) {
                dPitch *= this.compression;
            }

            const targetYaw = this.pivot.yaw + dYaw;
            let targetPitch = this.pivot.pitch + dPitch;

            if (targetPitch > this.maxPitch) {
                targetPitch = this.maxPitch;
            }

            Rotations.applyRotationWithGCD(targetYaw, targetPitch);

            setTimeout(() => this.rotateLoop(), 10);
        } catch (e) {
            Chat.message(`error in rotateLoop: ${e}`);
            console.error(e);
            setTimeout(() => this.rotateLoop(), 1000);
        }
    }
}

new PowderMacro();
