import { Failsafe } from "../Failsafe";
import getFailsafeSettings from "../ConfigWrapper";
import { Chat } from "../../utils/Chat";
let MacroState = global.MacroState;

class PlayerGreifFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = getFailsafeSettings("Player Greif");
        this.lastTrigger = 0;
        this.cooldownMs = 5000;
        this.registerGreifListeners();
    }

    registerGreifListeners() {
        register("step", () => {
            this.settings = getFailsafeSettings("Player Greif");
            if (!this.settings.isEnabled) return;
            
            const now = Date.now();
            if (now - this.lastTrigger < this.cooldownMs) return;
            
            const look = Player.lookingAt();
            if (!(look instanceof PlayerMP)) return;
            if (look.getUUID()?.version() === 2) return;
            const px = Player.getX();
            const py = Player.getY();
            const pz = Player.getZ();
            const lx = look.getX();
            const ly = look.getY();
            const lz = look.getZ();

            if (Math.trunc(lx) === Math.trunc(px) && 
                Math.trunc(ly) === Math.trunc(py) && 
                Math.trunc(lz) === Math.trunc(pz)) {
                Chat.message(`&c&lWARNING: ${look.getName()} is standing inside you!`);
                this.lastTrigger = now;
            }
        })
    }
}

export default new PlayerGreifFailsafe();