import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { attachMixin } from '../../utils/AttachMixin';
import { getPlayerName } from '../../Mixins/PlayerListEntryMixin';
import { addMessage } from '../../Mixins/ChatHudMixin';

class ProfileHider extends ModuleBase {
    constructor() {
        super({
            name: 'Profile Hider',
            subcategory: 'Visuals',
            description: 'Hides your profile',
        });

        this.defaultName = null;
        this.HIDE_USERNAME = false;
        this.USERNAME = null;

        this.addToggle('Custom Username', (v) => (this.HIDE_USERNAME = v), 'Allows for custom usernames', true);
        this.addTextInput('Username', ' ', (v) => (this.USERNAME = v), 'The username you want to use');

        this.UsernameMixins();
    }

    UsernameMixins() {
        attachMixin(getPlayerName, 'getPlayerName', (instance, originalText) => {
            return this.getModifiedText(originalText);
        });

        attachMixin(addMessage, 'addMessage', (instance, originalText) => {
            return this.getModifiedText(originalText);
        });
    }

    getModifiedText(originalTextComponent) {
        if (!originalTextComponent || !this.HIDE_USERNAME || !this.enabled) return originalTextComponent;
        if (!this.defaultName) this.defaultName = this.getUsername();

        const username = Player.getName();
        const customUsername = this.USERNAME?.trim() || this.defaultName || 'Failed to get username';

        const Text = net.minecraft.text.Text;
        const newComponent = Text.empty();

        originalTextComponent.visit((style, content) => {
            if (content.includes(username)) {
                const parts = content.split(username);

                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].length > 0) {
                        newComponent.append(Text.literal(parts[i]).setStyle(style));
                    }

                    if (i < parts.length - 1) {
                        newComponent.append(this.chroma(customUsername));
                    }
                }
            } else {
                newComponent.append(Text.literal(content).setStyle(style));
            }

            return java.util.Optional.empty();
        }, net.minecraft.text.Style.EMPTY);

        return newComponent;
    }

    chroma(text) {
        const Text = net.minecraft.text.Text;
        const mutableText = Text.empty();
        const speed = 2000;
        const offset = 100;

        for (let i = 0; i < text.length; i++) {
            const hue = (Date.now() % speed) / speed + (i * offset) / (speed * 2);
            const hexColor = java.awt.Color.getHSBColor(hue % 1, 0.8, 1.0).getRGB() & 0xffffff;

            mutableText.append(Text.literal(text[i]).styled((s) => s.withColor(hexColor).withBold(true)));
        }
        return mutableText;
    }

    getUsername() {
        try {
            const saved = Utils.getConfigFile('AuthCache/do_not_share_this_file')?.username;
            if (saved) return saved;
        } catch (e) {
            console.error('Failed to load saved username');
        }
        return null;
    }
}

new ProfileHider();
