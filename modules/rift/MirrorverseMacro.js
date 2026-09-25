import { ModuleBase } from '../../utils/ModuleBase';
import { setKeysForStraightLineCoords } from '../../utils/player/Movement';

const ROOM = { minX: -267, maxX: -260, minZ: -110, maxZ: -102, minY: 32, maxY: 40 };
const CENTER_THRESHOLD = 0.5;
const STOPPING_TICKS = 2.2;
const EXIT = { x: -263.5, z: -106.5 };
const SubtitlePacket = net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;

class MirrorverseMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Mirrorverse Dance Macro',
            subcategory: 'Rift',
            description: 'Completes the Mirrorverse dance room. Enable while standing beside green glass start.',
            tooltip: 'Completes the Mirrorverse dance room. Enable while standing beside green glass start.',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.on('packetReceived', (packet) => this.readInstruction(packet)).setFilteredClass(SubtitlePacket);

        this.on('chat', (event) => {
            if (this.exiting || !event.message.getUnformattedText().includes('You completed the FULL dance! Amazing!')) return;
            this.exiting = true;
            Client.unpressKeys();
        });

        this.on('tick', () => this.tick());
    }

    inRoom() {
        const x = Player.getX();
        const y = Player.getY();
        const z = Player.getZ();
        return x >= ROOM.minX && x <= ROOM.maxX + 1 && z >= ROOM.minZ && z <= ROOM.maxZ + 1 && y >= ROOM.minY && y <= ROOM.maxY;
    }

    resetDance() {
        this.instruction = '';
        this.shiftActive = false;
        this.acted = false;
        this.target = null;
        this.jumpHeld = false;
        this.punchReady = false;
        Client.stopMovement();
        Client.setKey('space', false);
        Client.setKey('shift', false);
    }

    readInstruction(packet) {
        if (this.exiting || !this.inRoom()) return;
        const text = ChatLib.removeFormatting(String(packet.text().getString())).trim();
        if (!text) return;
        const action = text.toLowerCase().replace(/’/g, "'");
        if (!['move', 'stand', 'sneak', 'jump', 'punch'].some((word) => action.includes(word))) return;

        this.instruction = action;
        this.punchReady = action === 'punch!';
        if (!action.includes('sneak')) this.shiftActive = false;
        Client.setKey('shift', this.shiftActive);
        this.acted = false;
    }

    findGlass() {
        const floor = Math.floor(Player.getY()) - 1;
        const minY = this.floorY ?? ROOM.minY - 2;
        const maxY = this.floorY ?? ROOM.maxY;
        let closest = null;
        for (let y = minY; y <= maxY; y++) {
            for (let x = ROOM.minX; x <= ROOM.maxX; x++) {
                for (let z = ROOM.minZ; z <= ROOM.maxZ; z++) {
                    const name = World.getBlockAt(x, y, z)?.type?.getRegistryName();
                    if (!name?.endsWith('_stained_glass')) continue;
                    if (this.floorY !== null) return { x: x + 0.5, z: z + 0.5 };
                    if (!closest || Math.abs(y - floor) < Math.abs(closest.y - floor)) closest = { x: x + 0.5, y, z: z + 0.5 };
                }
            }
        }
        if (closest) this.floorY = closest.y;
        return closest;
    }

    moveTo(x, z, threshold) {
        const dx = x - Player.getX();
        const dz = z - Player.getZ();
        const distance = Math.hypot(dx, dz);
        const motionTowardTarget = distance ? (dx * Player.getMotionX() + dz * Player.getMotionZ()) / distance : 0;
        const stoppingDistance = Math.max(0, motionTowardTarget) * STOPPING_TICKS;
        if (distance > threshold + stoppingDistance) setKeysForStraightLineCoords(x, Player.getY(), z, false);
        else Client.stopMovement();
        return distance;
    }

    tick() {
        if (this.jumpHeld) {
            Client.setKey('space', false);
            this.jumpHeld = false;
        }
        if (!this.inRoom()) {
            this.toggle(false);
            return;
        }
        if (Client.isInGui() && !Client.isInChat()) {
            if (this.target) Client.stopMovement();
            this.target = null;
            return;
        }
        if (this.exiting) {
            this.moveTo(EXIT.x, EXIT.z, 0.15);
            return;
        }
        if (this.punchReady) {
            Client.leftClick();
            this.punchReady = false;
        }

        if (this.floorY === null && Date.now() - this.lastScanAt < 200) return;
        this.lastScanAt = Date.now();
        const target = this.findGlass();
        if (!target) {
            if (this.target) Client.stopMovement();
            this.target = null;
            return;
        }
        this.target = target;

        const distance = this.moveTo(target.x, target.z, CENTER_THRESHOLD);

        if (this.instruction.includes('sneak') && distance <= CENTER_THRESHOLD) this.shiftActive = true;
        Client.setKey('shift', this.shiftActive);
        if (distance > CENTER_THRESHOLD || !this.instruction) return;

        if (!this.acted) {
            if (this.instruction.includes('jump') && !this.instruction.includes("don't jump")) {
                if (Math.hypot(Player.getMotionX(), Player.getMotionZ()) > 0.03 || !Player.getPlayer()?.onGround()) return;
                Client.setKey('space', true);
                this.jumpHeld = true;
            }
            this.acted = true;
        }
    }

    onEnable() {
        if (!this.inRoom()) {
            this.message('&cStart inside the Mirrorverse dance room.');
            this.toggle(false);
            return;
        }
        this.floorY = null;
        this.lastScanAt = 0;
        this.exiting = false;
        this.resetDance();
    }

    onDisable() {
        Client.unpressKeys();
    }
}

new MirrorverseMacro();
