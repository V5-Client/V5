import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import getFailsafeSettings from "../ConfigWrapper";
import { Webhook } from "../../utils/Webhooks";

class SlotChangeFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = getFailsafeSettings("Slot Change");
        this.registerSlotChangeListeners();
    }

    registerSlotChangeListeners() {
        register("packetReceived", (packet) => {
            this.settings = getFailsafeSettings("Slot Change");
            if (!this.settings?.["Slot Change Failsafe"]) return;
            const currentSlot = Player.getHeldItemIndex() + 1;
            const newSlot = packet.slot() + 1; // first slot is 0 so +1 to match hotbar index ig
            if (currentSlot === newSlot) return;
            setTimeout(() => {
                this.onTrigger(currentSlot, newSlot);
            }, this.settings?.["Failsafe Detection Delay (ms)"] - 50 || 600)
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.UpdateSelectedSlotS2CPacket);
    }

    onTrigger(fromSlot, toSlot) {
        Chat.message(`The server has changed your held slot from slot ${fromSlot} to slot ${toSlot}!`);
        Webhook.sendEmbed([
            {
                title: "**Slot Change Failsafe Triggered!**",
                description: `Slot changed from ${fromSlot} to ${toSlot}`,
                color: 8388608,
                footer: { text: `V5 Failsafes` },
                timestamp: new Date().toISOString(),
            },
        ]);
    }
}

export default new SlotChangeFailsafe();