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
        
        // High severity patterns - match words commonly associated with reports/bans
        this.highSeverityPatterns = [
            /\bwdr\b/i,           // Watchdog Report
            /\breport(ing|ed)?\b/i,  // report, reporting, reported
            /\bcheat(ing|er|s)?\b/i, // cheat, cheating, cheater, cheats
        ];
        
        // Medium severity patterns - match words that may indicate suspicion
        this.mediumSeverityPatterns = [
            /\bmacro(ing|er|s)?\b/i,      // macro, macroing, macroer, macros
            /\bbot(ting|ter|s)?\b/i,      // bot, botting, botter, bots
            /\bautomating?\b/i,           // automate, automating
            /\bexploit(ing|er|s)?\b/i,    // exploit, exploiting, exploiter, exploits
        ];
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
            this.onTrigger(result.blockedWord, result.severity); 
        }).setCriteria(/(.+)/);
        
        registerEventSB("serverchange", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        register("worldLoad", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("death", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("warp", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
    }

    isBad(msg) {
        // Check high severity patterns first
        for (const pattern of this.highSeverityPatterns) {
            const match = msg.match(pattern);
            if (match) {
                return { isBlocked: true, blockedWord: match[0], severity: "high" };
            }
        }
        
        // Check medium severity patterns
        for (const pattern of this.mediumSeverityPatterns) {
            const match = msg.match(pattern);
            if (match) {
                return { isBlocked: true, blockedWord: match[0], severity: "medium" };
            }
        }

        return { isBlocked: false, blockedWord: null, severity: null };
    }

    onTrigger(word, severity) {
        const pressure = severity === "high" ? 30 : 10;

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