import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { registerEventSB } from "../../utils/SkyblockEvents"
import getFailsafeSettings from "../ConfigWrapper";

class ChatMentionFailsafe extends Failsafe {
    constructor() {
        super();
        this.ignore = false;
        this.settings = getFailsafeSettings("Chat Mention");
        this.registerChatListeners();
    }

    registerChatListeners() {
        register("chat", (message) => {
            const playerName = Player.getName();
            if (!message.toLowerCase().includes(playerName.toLowerCase())) return /// TODO: add custom failsafe words list?
            Chat.message("You were mentioned in chat!"); 
        }).setCriteria(/(.+)/);
    }

    onTrigger() {}
}

export default new ChatMentionFailsafe();