import { Chat } from "../utils/Chat";
import { Failsafe } from "./Failsafe";

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.lastX = null;
        this.lastY = null;
        this.lastZ = null;

        this.registerTPListeners();
    }

    registerTPListeners() {
        register("packetReceived", (packet) => {
            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();
            const newX = packet.change().position().x
            const newY = packet.change().position().y
            const newZ = packet.change().position().z

            this.onTrigger(fromX.toFixed(2), fromY.toFixed(2), fromZ.toFixed(2), newX.toFixed(2), newY.toFixed(2), newZ.toFixed(2));
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.PlayerPositionLookS2CPacket)
    }

    onTrigger(fromX, fromY, fromZ, toX, toY, toZ) {
        Chat.message(`You have been teleported!`);
        Chat.message(`from ${fromX} ${fromY} ${fromZ} to ${toX} ${toY} ${toZ}`);
    }
}

export default new TeleportFailsafe();
