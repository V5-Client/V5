import { ModuleBase } from '../../utils/ModuleBase';
import { setMixinValue } from '../../utils/MixinManager';

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
            (value) => setMixinValue('forcePerspective', value),
            'Automatically switches to third person while macro is running.',
            false,
            sectionName
        );

        this.addDirectToggle('Limit FPS', (value) => setMixinValue('limitFps', value), 'Limits FPS while macro is running.', false, sectionName);
        this.addDirectToggle('Mute Game', (value) => setMixinValue('muteGame', value), 'Mutes game audio while macro is running.', false, sectionName);

        this.addDirectMultiToggle(
            'Render Limiters',
            ['Off', 'Limit Chunks', 'No Render'],
            true,
            (value) => setMixinValue('renderLimiter', value?.find?.((option) => option.enabled)?.name || 'Off'),
            'Limits render distance or cancels rendering while macro is running.',
            'Off',
            sectionName
        );
    }
}

new Controller();
