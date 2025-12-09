import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { registerEventSB } from "../../utils/SkyblockEvents"
import getFailsafeSettings from "../ConfigWrapper";
import { Webhook } from "../../utils/Webhooks";
import { Vec3d } from "../../utils/Constants";

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.lastX = null;
        this.lastY = null;
        this.lastZ = null;
        this.ignore = false;
        this.nullPacket = new Vec3d(0, 0, 0)
        this.settings = getFailsafeSettings("Teleport");
        this.registerTPListeners();
    }

    registerTPListeners() {
        register("packetReceived", (packet) => {
            this.settings = getFailsafeSettings("Teleport")
            if (!this.settings?.["TP Failsafe"]) return;
            if (Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase()?.includes("aspect of the")) return;
            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();
            const currYaw = Player.getYaw();
            const currPitch = Player.getPitch();
            
            const newX = packet.change().position().x
            const newY = packet.change().position().y
            const newZ = packet.change().position().z
            const newYaw = packet.change().yaw()
            const newPitch = packet.change().pitch()
            
            if (new Vec3d(newX, newY, newZ).equals(this.nullPacket)) {
                Chat.message("NULL PACKET DETECTED, DO NOT REACT!")
                Webhook.sendEmbed([
                   {
                       title: "**NULL PACKET DETECTED!**",
                       description: `Null packet detected: ${newX} ${newY} ${newZ}`,
                       color: 8388608,
                       footer: { text: `V5 Failsafes` },
                       timestamp: new Date().toISOString(),
                    },
                ])
                return;
            }
            setTimeout(() => {
                if (this.ignore) return
                this.onTrigger(fromX.toFixed(2), fromY.toFixed(2), fromZ.toFixed(2), newX.toFixed(2), newY.toFixed(2), newZ.toFixed(2), currYaw.toFixed(2), currPitch.toFixed(2), newYaw.toFixed(2), newPitch.toFixed(2));
            }, this.settings?.["Failsafe Detection Delay (ms)"] - 50|| 600)
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.PlayerPositionLookS2CPacket)

        registerEventSB("death", () => {
            this.ignore = true
            setTimeout(() => {
                this.ignore = false
            }, this.settings?.["Failsafe Detection Delay (ms)"] || 650)
        })

        registerEventSB("warp", () => {
            this.ignore = true
            setTimeout(() => {
                this.ignore = false
            }, this.settings?.["Failsafe Detection Delay (ms)"] || 650)
        })
    }

    onTrigger(fromX, fromY, fromZ, toX, toY, toZ, fromYaw, fromPitch, toYaw, toPitch) {
        Chat.message(`You have been teleported (or rotated)!`);
        Chat.message(`from ${fromX} ${fromY} ${fromZ} to ${toX} ${toY} ${toZ} (yaw ${fromYaw} -> ${toYaw}, pitch ${fromPitch} -> ${toPitch})`);
        Webhook.sendEmbed([
            {
                title: "**Teleport/Rotation Failsafe Triggered!**",
                description: `Teleported from (${fromX}, ${fromY}, ${fromZ}) to (${toX}, ${toY}, ${toZ}) (yaw ${fromYaw} -> ${toYaw}, pitch ${fromPitch} -> ${toPitch})`,
                color: 8388608,
                footer: { text: `V5 Failsafes` },
                timestamp: new Date().toISOString(),
            },
        ]);
    }
}

export default new TeleportFailsafe();