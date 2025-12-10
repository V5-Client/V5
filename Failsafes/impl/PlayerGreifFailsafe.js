import { Failsafe } from "../Failsafe";
import getFailsafeSettings from "../ConfigWrapper";
import { Chat } from "../../utils/Chat";
let MacroState = global.MacroState;

class PlayerGreifFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = getFailsafeSettings("Player Greif");
        this.lastInsideTrigger = 0;
        this.lastNearbyTrigger = 0;
        this.insideCooldownMs = 5000;
        this.nearbyCooldownMs = 3000;
        this.registerGreifListeners();
    }

    registerGreifListeners() {
        register("step", () => {
            if (!MacroState.isMacroRunning()) return;
            this.settings = getFailsafeSettings("Player Greif");
            if (!this.settings.isEnabled) return;
            if (!World.isLoaded() || !Player.asPlayerMP()) return;
            
            const now = Date.now();
            
            if (now - this.lastInsideTrigger >= this.insideCooldownMs) {
                this.checkPlayerInside(now);
            }
            
            if (now - this.lastNearbyTrigger >= this.nearbyCooldownMs) {
                this.checkPlayerNearby(now);
            }
        })
    }
    
    checkPlayerInside(now) {
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
            this.lastInsideTrigger = now;
        }
    }
    
    checkPlayerNearby(now) {
        this.settings = getFailsafeSettings("Player Greif");
        if (!this.settings.playerGreif) return;
        const look = Player.lookingAt();
        if (!(look instanceof PlayerMP)) return;
        if (look.getUUID()?.version() === 2) return;
        
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        const lx = look.getX();
        const ly = look.getY();
        const lz = look.getZ();
        
        const dx = lx - px;
        const dy = ly - py;
        const dz = lz - pz;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        const maxDistance = this.settings.playerProximityDistance || 3;

        if (distance <= maxDistance && distance > 1) {
            Chat.message(`${look.getName()} is ${distance.toFixed(1)} blocks away from you! They could be checking you!`);
            this.lastNearbyTrigger = now;
        }
    }
}

export default new PlayerGreifFailsafe();