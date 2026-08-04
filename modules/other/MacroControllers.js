import { ModuleBase } from '../../utils/ModuleBase';
import { MacroState } from '../../utils/MacroState';
import { Mixin } from '../../utils/MixinManager';

class Controller extends ModuleBase {
    constructor() {
        super({
            name: 'Controller',
            subcategory: 'Core',
            description: 'Various toggles to improve peformance while game is minimized.',
            hideInModules: true,
        });

        let sectionName = 'Macro Controllers';

        this.addDirectToggle(
            'Auto-Perspective',
            (value) => Mixin.set('forcePerspective', value),
            'Automatically switches to third person while macro is running.',
            false,
            sectionName
        );

        this.addDirectToggle('Limit FPS', (value) => Mixin.set('limitFps', value), 'Limits FPS while macro is running.', false, sectionName);
        this.addDirectToggle('Mute Game', (value) => Mixin.set('muteGame', value), 'Mutes game audio while macro is running.', false, sectionName);

        this.addDirectMultiToggle(
            'Render Limiters',
            ['Off', 'Limit Chunks', 'No Render'],
            true,
            (value) => Mixin.set('renderLimiter', value?.find?.((option) => option.enabled)?.name || 'Off'),
            'Limits render distance or cancels rendering while macro is running.',
            'Off',
            sectionName
        );

        this.addDirectToggle(
            'Picture-in-Picture (PiP)',
            (value) => {
                const pip = MacroState.getModule('PiP');
                if (pip && typeof pip.toggle === 'function') pip.toggle(value);
            },
            'Shrinks the game window into a small always-on-top picture-in-picture window. Configure it in Modules > Visuals > PiP.',
            false,
            sectionName
        );
    }
}

new Controller();
