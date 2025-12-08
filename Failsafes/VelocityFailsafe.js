import { Chat } from "../utils/Chat";
import { Failsafe } from "./Failsafe";

class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
    }

    registerVeloListeners() {
        register("packetReceived", (packet) => {
            if (packet.getEntityId() !== Player.asPlayerMP().mcValue.getId()) return;
            const vx = packet.getVelocityX();
            const vy = packet.getVelocityY();
            const vz = packet.getVelocityZ();
            const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
            this.onTrigger(speed);
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.EntityVelocityUpdateS2CPacket);
    }

    onTrigger(speed) {
        // Chat.message("Velocity failsafe triggered!")
        // Chat.message(`Velocity: ${speed}`)
    }
}

export default new VelocityFailsafe();
