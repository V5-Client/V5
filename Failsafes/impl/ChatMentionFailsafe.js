import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { getFailsafeSettings, incrementFailsafeIntensity } from "../FailsafeUtils";
import { Webhook } from "../../utils/Webhooks";
import MacroState from "../../utils/MacroState";
import { registerEventSB } from "../../utils/SkyblockEvents";

class ChatMentionFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = getFailsafeSettings("Chat Mention");
        this.registerChatListeners();
        this.ignore = false;
        this.FailsafeReactionTime = 600;
        this.isFailsafeEnabled = true;
        this.blacklistedWords = [
            "macro",
            "report",
            "wdr",
            "cheating",
            "cheater"
          //  `${Player.getName()}`, // add later when i can stop false positives
        ]
    }

    registerChatListeners() {
        register("chat", (msg) => {
            if (!MacroState.isMacroRunning()) return;
            if (this.ignore) return

            this.settings = getFailsafeSettings("Chat Mention");
            if (!this.settings.isEnabled) return;
            this.FailsafeReactionTime = this.settings.FailsafeReactionTime || 600

            const result = this.isBad(msg);
            if (!result.isBlocked) return
            this.onTrigger(result.blockedWord); 
        }).setCriteria(/(.+)/);
        
        registerEventSB("serverchange", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        register("worldLoad", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("death", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("warp", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
    }

    isBad(msg) {
        let found = null;
        const lower = msg.toLowerCase();
        const isBlocked = this.blacklistedWords.some(word => { if (lower.includes(word.toLowerCase())) { found = word; return true; } return false; });

        return { isBlocked: isBlocked, blockedWord: found };
    }

    onTrigger(word) {
        const highSeverityWords = ["wdr", "report", "cheating", "cheater"];
        let pressure;
        let severity;
        if (highSeverityWords.includes(word.toLowerCase())) {
            pressure = 30;
            severity = "high";
        } else {
            pressure = 10;
            severity = "medium";
        }

        Chat.failsafeMsg(`Detected blacklisted word! (${word}) (${severity} severity)`);
        incrementFailsafeIntensity(pressure);
        Webhook.sendEmbed([
            {
                title: `**Chat Mention Failsafe Triggered! [${severity}]**`,
                description: `Someone mentioned: "${word}"`,
                color: severity === "high" ? 16744448 : 16776960,
                footer: { text: `V5 Failsafes` },
                timestamp: new Date().toISOString(),
            },
        ]);
    }
}

export default new ChatMentionFailsafe();