import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { MCHand, Vec3d } from '../../utils/Constants';
import { PlayerInteractEntityC2S } from '../../utils/Packets';
import { Guis } from '../../utils/player/Inventory';

class MinionCollector extends ModuleBase {
    constructor() {
        super({
            name: 'Minion Collector',
            subcategory: 'Skills',
            description: 'Auto Collects Minions using Aura - Caution!',
            tooltip: 'Auto Collects Minions using Aura - Caution!',
            showEnabledToggle: true,
        });

        this.unopenedMinions = [];
        this.collectedMinions = new Set();
        this.interactionQueue = [];
        this.inMinion = false;
        this.lastCollection = 0;

        this.when(
            () => this.enabled && Utils.area() === 'Private Island',
            'tick',
            () => {
                this.clickSlot();

                if (this.inMinion) return;
                this.scanAndQueue();

                if (!Client.isInGui()) this.processQueue();
            }
        );
    }

    scanAndQueue() {
        let targets = [];
        const player = Player.getPlayer();
        if (!player) return;
        const entities = World.getAllEntitiesOfType(ArmorStandEntity);
        const playerPos = [player.getX(), player.getY(), player.getZ()];

        for (let entity of entities) {
            const x = Math.floor(entity.getX());
            const y = Math.floor(entity.getY());
            const z = Math.floor(entity.getZ());
            const posKey = `${x},${y},${z}`;

            if (this.collectedMinions.has(posKey)) continue;

            let hasItem = false;
            for (let i = 0; i <= 5; i++) {
                if (entity.getStackInSlot(i)) {
                    hasItem = true;
                    break;
                }
            }
            if (!hasItem) continue;

            if (this.withinRange(playerPos, [x, y, z])) {
                const id = entity.toMC().getEntity().getId();
                if (!this.interactionQueue.some((e) => e.toMC().getEntity().getId() === id)) {
                    this.interactionQueue.push(entity);
                }
            } else {
                targets.push({ x, y, z });
            }
        }
        this.unopenedMinions = targets;
    }

    processQueue() {
        if (this.interactionQueue.length === 0 || Client.isInGui()) return;

        const entity = this.interactionQueue.shift();
        const posKey = `${Math.floor(entity.getX())},${Math.floor(entity.getY())},${Math.floor(entity.getZ())}`;

        this.collectedMinions.add(posKey);
        this.inMinion = true;
        this.rightClickMinion(entity);
    }

    clickSlot() {
        if (!this.inMinion) return;

        const name = Guis.guiName();
        if (!name || !name.includes('Minion')) return;

        if (this.lastCollection === 0) {
            Guis.clickSlot(48);
            this.lastCollection = Date.now();
            return;
        }

        if (Date.now() - this.lastCollection >= 500) {
            Guis.closeInv();
            this.inMinion = false;
            this.lastCollection = 0;
        }
    }

    withinRange(from, to) {
        return Math.hypot(from[0] - to[0], from[1] - to[1], from[2] - to[2]) < 3;
    }

    rightClickMinion(entity) {
        const ent = entity.toMC().getEntity();
        const vec = new Vec3d(0.0, 0.5, 0.0);
        const packet = PlayerInteractEntityC2S.interactAt(ent, false, MCHand.MAIN_HAND, vec);
        Client.sendPacket(packet);
        this.lastCollection = 0;
    }
}

new MinionCollector();
