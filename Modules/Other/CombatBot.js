import { ModuleBase } from '../../Utility/ModuleBase';
import { Chat } from '../../Utility/Chat';
import { Vec3d } from '../../Utility/Constants';
import RenderUtils from '../../Rendering/RendererUtils';
import { MathUtils } from '../../Utility/Math';
import { Rotations } from '../../Utility/Rotations';
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

        this.on('postRenderWorld', () => {
            if (!this.targets) return;

            if (this.target) {
                const thickness = 7;
                const color = [255, 0, 0, 255];
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
            this.targets = this.detectTargets();
            this.target = this.bestTarget();
            Rotations.rotateToVector(new Vec3d(this.target.x, this.target.y + 1.5, this.target.z), 1, true);
        });
    }

    detectTargets() {
        // shitty ghosts for now
        return World.getAllEntitiesOfType(net.minecraft.class_1548).filter((target) => !target.isDead() && target.y < 77);
    }

    bestTarget() {
        this.costs.clear();
        let lowestCost = Infinity;
        let bestTarget = null;
        this.targets.forEach((target) => {
            const distance = Math.sqrt((Player.getX() - target.x) ** 2 + (Player.getY() - target.y) ** 2 + (Player.getZ() - target.z) ** 2);
            const angles = MathUtils.angleToPlayer([target.x, target.y, target.z]);
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
    }
}

export const CombatBot = new Combat();
