import { setMixinValue } from '../../utils/MixinManager';
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

        this.addToggle(
            'Custom Username',
            (v) => {
                this.HIDE_USERNAME = v;
                this.updateMixin();
            },
            'Allows for custom usernames',
            true
        );
        this.addTextInput(
            'Username',
            ' ',
            (v) => {
                this.USERNAME = v;
                this.updateMixin();
            },
            'The username you want to use'
        );
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

    updateMixin() {
        if (!this.defaultName) this.defaultName = this.getUsername();
        setMixinValue('profileHiderReplacement', (this.HIDE_USERNAME && this.USERNAME?.trim()) || this.defaultName || 'Hidden');
    }

    onEnable() {
        this.updateMixin();
        setMixinValue('profileHiderEnabled', true);
    }

    onDisable() {
        setMixinValue('profileHiderEnabled', false);
    }
}

new ProfileHider();
