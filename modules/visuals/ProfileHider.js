import { ModuleBase } from '../../utils/ModuleBase';
import { getConfigFile } from '../../utils/Utils';

class ProfileHider extends ModuleBase {
    constructor() {
        super({
            name: 'Profile Hider',
            subcategory: 'Visuals',
            description: 'Hides your profile',
        });

        this.defaultName = null;
        this.HIDE_USERNAME = true;
        this.USERNAME = null;

        this.addToggle('Custom Username', (v) => (this.HIDE_USERNAME = v), 'Allows for custom usernames', true);
        this.addTextInput('Username', ' ', (v) => (this.USERNAME = v), 'The username you want to use');

        Client.setNameProcessor(null);
        this.on('tick', () => this.updateName());
        register('gameUnload', () => Client.setNameReplacement(null, null));
    }

    onEnable() {
        this.defaultName = this.getUsername();
        this.updateName();
    }

    onDisable() {
        Client.setNameReplacement(null, null);
    }

    updateName() {
        const username = this.HIDE_USERNAME ? Player.getName() : null;
        Client.setNameReplacement(username, this.USERNAME?.trim() || this.defaultName || 'Failed to get username');
    }

    getUsername() {
        try {
            const saved = getConfigFile('AuthCache/do_not_share_this_file')?.username;
            if (saved) return saved;
        } catch (e) {
            console.error(e);
            console.error('Failed to load saved username');
        }
        return null;
    }
}

new ProfileHider();
