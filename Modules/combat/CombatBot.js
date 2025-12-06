import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import RenderUtils from '../../utils/render/RendererUtils';
import { MathUtils } from '../../utils/Math';
import { Rotations } from '../../utils/player/Rotations';
// just random tests for now

class Combat extends ModuleBase {
    constructor() {
        super({
            name: 'Combat Bot',
            subcategory: 'Combat',
            description: 'Universal settings for combat bot',
            tooltip: 'Combat bot settings',
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.settingsTarget = null;
        this.target = null;
        this.targetNametag = null;
        this.targets = [];
        this.costs = new Map();
        this.externalTargets = [];
        this.useExternalTargetsOnly = false;

        this.on('postRenderWorld', () => {
            if (!this.targets || this.targets.length === 0) return;

            if (this.target) {
                const thickness = 7;
                const color = [255, 0, 0, 100];
                const entity = this.target.toMC ? this.target.toMC() : this.target;

                RenderUtils.drawEntityHitbox(entity, color, thickness, false);
            }

            const blueColor = [0, 70, 200, 100];
            const blueThickness = 3;

            this.targets.forEach((target) => {
                if (target === this.target) {
                    return;
                }

                const entity = target.toMC ? target.toMC() : target;

                RenderUtils.drawEntityHitbox(entity, blueColor, blueThickness, false);
            });
        });

        this.on('tick', () => {
            if (!Client.isInChat() && Client.isInGui()) return;

            this.targets = this.getTargets();
            this.target = this.bestTarget();

            if (!this.target) return;

            const pos = this.getTargetPosition(this.target);
            if (!pos) return;

            Rotations.rotateToVector(new Vec3d(pos.x, pos.y + 1.5, pos.z), 1, true);
        });
    }

    detectTargets() {
        // THIS IS FROM ZURVIQ. comm macro makes sure it doesnt get fallbacked to this if no mobs found
        return World.getAllEntitiesOfType(net.minecraft.class_1548).filter((target) => !target.isDead() && target.y < 77);
    }

    getTargets() {
        if (this.useExternalTargetsOnly) {
            return this.externalTargets || [];
        }

        if (this.externalTargets && this.externalTargets.length > 0) {
            return this.externalTargets;
        }

        return this.detectTargets();
    }

    setExternalTargets(targets) {
        this.useExternalTargetsOnly = true;

        if (Array.isArray(targets)) {
            this.externalTargets = targets;
        } else {
            this.externalTargets = [];
        }
    }

    clearExternalTargets() {
        this.externalTargets = [];
    }

    getTargetPosition(target) {
        if (!target) return null;

        try {
            if (typeof target.getX === 'function') {
                return { x: target.getX(), y: target.getY(), z: target.getZ() };
            }

            if (typeof target.x === 'number' && typeof target.y === 'number' && typeof target.z === 'number') {
                return { x: target.x, y: target.y, z: target.z };
            }

            const entity = target.toMC ? target.toMC() : target;
            if (entity && typeof entity.getX === 'function') {
                return { x: entity.getX(), y: entity.getY(), z: entity.getZ() };
            }
        } catch (e) {}

        return null;
    }

    bestTarget() {
        this.costs.clear();
        let lowestCost = Infinity;
        let bestTarget = null;

        if (!this.targets || this.targets.length === 0) return null;

        this.targets.forEach((target) => {
            const pos = this.getTargetPosition(target);
            if (!pos) return;

            const distance = MathUtils.fastDistance(Player.getX(), Player.getY(), Player.getZ(), pos.x, pos.y, pos.z);
            const angles = MathUtils.angleToPlayer([pos.x, pos.y, pos.z]);
            const cost = distance * 10 + angles.distance;

            this.costs.set(target, cost);

            if (cost < lowestCost) {
                lowestCost = cost;
                bestTarget = target;
            }
        });

        return bestTarget;
    }

    onEnable() {
        Chat.message('&aCombat Bot Enabled');
    }

    onDisable() {
        Chat.message('&cCombat Bot Disabled');
        Rotations.stopRotation();

        this.externalTargets = [];
        this.useExternalTargetsOnly = false;
        this.targets = [];
        this.target = null;
    }
}

export const CombatBot = new Combat();
