import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { registerEventSB } from "../../utils/SkyblockEvents"
import FailsafeManager from "../FailsafeManager";

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.lastX = null;
        this.lastY = null;
        this.lastZ = null;
        this.ignore = false;
        this.settings = FailsafeManager.getFailsafeSettings("Teleport");
        this.registerTPListeners();
    }

    registerTPListeners() {
        register("packetReceived", (packet) => {
            if (Player.getHeldItem().getName().removeFormatting().toLowerCase().includes("aspect of the")) return;
            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();
            const newX = packet.change().position().x
            const newY = packet.change().position().y
            const newZ = packet.change().position().z
            if (Number(Math.trunc(newX)) === -48 && Number(Math.trunc(newY)) === 200 && Number(Math.trunc(newZ)) === -121) return // mines warp coords, needed for death ig, maybe redundant/remove?
            setTimeout(() => {
                if (this.ignore) return
                this.onTrigger(fromX.toFixed(2), fromY.toFixed(2), fromZ.toFixed(2), newX.toFixed(2), newY.toFixed(2), newZ.toFixed(2));
            }, this.settings?.["Failsafe Detection Delay (ms)"] - 50|| 600)
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.PlayerPositionLookS2CPacket)

        registerEventSB("death", function () {
            this.ignore = true
            setTimeout(() => {
                this.ignore = false
            }, this.settings?.["Failsafe Detection Delay (ms)"] || 650)
        }.bind(this))

        registerEventSB("warp", function () {
            this.ignore = true
            setTimeout(() => {
                this.ignore = false
            }, this.settings?.["Failsafe Detection Delay (ms)"] || 650)
        }.bind(this))

        register("step", () => {
            this.settings = FailsafeManager.getFailsafeSettings("Teleport")
        }).setDelay(30)
    }

    onTrigger(fromX, fromY, fromZ, toX, toY, toZ) {
        Chat.message(`You have been teleported!`);
        Chat.message(`from ${fromX} ${fromY} ${fromZ} to ${toX} ${toY} ${toZ}`);
    }
}

export default new TeleportFailsafe();
