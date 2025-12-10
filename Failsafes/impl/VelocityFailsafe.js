import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { Webhook } from "../../utils/Webhooks";
import getFailsafeSettings from "../ConfigWrapper";

class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
        this.ignore = false
        this.settings = getFailsafeSettings("Velocity")
    }

    registerVeloListeners() {
        register("packetReceived", (packet) => {
            if (this.ignore) return
            this.settings = getFailsafeSettings("Velocity");
            if (!this.settings.isEnabled) return;
            if (packet.getEntityId() !== Player.asPlayerMP()?.mcValue?.getId()) return;
            if (Player.getHeldItem()?.getName()?.removeFormatting()?.includes("Grappling")) return;
            const playerPos = Player.asPlayerMP().mcValue.getPos();
            const blockBelow = World.getBlockAt(Math.floor(playerPos.getX()), Math.floor(playerPos.getY()) - 1, Math.floor(playerPos.getZ()));
            if (blockBelow.getType().getRegistryName().includes("slime_block")) return;
            const vx = packet.getVelocityX();
            const vy = packet.getVelocityY();
            const vz = packet.getVelocityZ();
            const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
            setTimeout(() => {this.onTrigger(speed)}, this.settings.FailsafeReactionTime - 50|| 600)
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.EntityVelocityUpdateS2CPacket);

        register("worldLoad", () => {this.ignore = true; setTimeout(() => this.ignore = false, this.settings.FailsafeReactionTime || 650)})
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
