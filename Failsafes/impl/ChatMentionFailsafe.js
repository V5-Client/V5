import { Utils } from "../../utils/Utils";
import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { registerEventSB } from "../../utils/SkyblockEvents"
import getFailsafeSettings from "../ConfigWrapper";
import { Webhook } from "../../utils/Webhooks";

class ChatMentionFailsafe extends Failsafe {
    constructor() {
        super();
        this.ignore = false;
        this.settings = getFailsafeSettings("Chat Mention");
        this.registerChatListeners();
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
            if (!this.isBad(msg).isBlocked) return
            Chat.message("Detected blacklisted word! (" + this.isBad(msg).blockedWord + ")");
            this.onTrigger(); 
        }).setCriteria(/(.+)/);
    }

    isBad(msg) {
        let found = null;
        const lower = msg.toLowerCase();
        const isBlocked = this.blacklistedWords.some(word => { if (lower.includes(word.toLowerCase())) { found = word; return true; } return false; });

        return { isBlocked: isBlocked, blockedWord: found };
    }

    onTrigger() {
        Webhook.sendEmbed([
            {
                title: "**Chat Mention Failsafe Triggered!**",
                description: `Someone mentioned a blacklisted word!`,
                color: 8388608,
                footer: { text: `V5 Failsafes` },
                timestamp: new Date().toISOString(),
            },
        ]);
    }
}

export default new ChatMentionFailsafe();