import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { Webhook } from "../../utils/Webhooks";

class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
    }

    registerVeloListeners() {
        register("packetReceived", (packet) => {
            if (packet.getEntityId() !== Player.asPlayerMP()?.mcValue?.getId()) return;
            if (Player.getHeldItem()?.getName()?.removeFormatting()?.includes("Grappling")) return;
            const playerPos = Player.asPlayerMP().mcValue.getPos();
            const blockBelow = World.getBlockAt(Math.floor(playerPos.getX()), Math.floor(playerPos.getY()) - 1, Math.floor(playerPos.getZ()));
            if (blockBelow.getType().getRegistryName().includes("slime_block")) return;
            const vx = packet.getVelocityX();
            const vy = packet.getVelocityY();
            const vz = packet.getVelocityZ();
            const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
            this.onTrigger(speed);
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.EntityVelocityUpdateS2CPacket);
    }

    onTrigger(speed) {
        Chat.message("Velocity failsafe triggered!")
        Chat.message(`Velocity: ${speed}`)
        Webhook.sendEmbed([
            {
                title: "**Velocity Failsafe Triggered!**",
                description: `High velocity detected: ${speed}`,
                color: 8388608,
                footer: { text: `V5 Failsafes` },
                timestamp: new Date().toISOString(),
            },
        ]);
    }
}

export default new VelocityFailsafe();
