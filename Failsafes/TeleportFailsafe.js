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
            if (packet instanceof net.minecraft.network.packet.s2c.play.PlayerPositionLookS2CPacket) {
                const fromX = Player.getX();
                const fromY = Player.getY();
                const fromZ = Player.getZ();

                try {
                    const str = packet.toString(); // this is SO cooked but it sadly works, nothign else would and the mappings site is down soo, maybe change later? idk
                    const match = str.match(/position=\(\s*([-\d\.]+),\s*([-\d\.]+),\s*([-\d\.]+)\s*\)/);
                    
                    if (match) {
                        const toX = parseFloat(match[1]);
                        const toY = parseFloat(match[2]);
                        const toZ = parseFloat(match[3]);
                        
                        this.onTrigger(fromX.toFixed(2), fromY.toFixed(2), fromZ.toFixed(2), toX.toFixed(2), toY.toFixed(2), toZ.toFixed(2));
                    } else {
                        Chat.debugMessage("regex failed matching packet :( you did get teleported tho so like, not very good i think")
                    }
                } catch (e) {
                    Chat.debugMessage("error reading teleport packet: " + e);
                    Chat.debugMessage("packet: " + packet.toString());
                }
            }
        });
    }

    onTrigger(fromX, fromY, fromZ, toX, toY, toZ) {
        Chat.message(`You have been teleported!`);
        Chat.message(`from ${fromX} ${fromY} ${fromZ} to ${toX} ${toY} ${toZ}`);
    }
}

export default new TeleportFailsafe();
