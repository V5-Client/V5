import { OverlayManager } from '../../gui/OverlayUtils';
import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { ModuleBase } from '../../utils/ModuleBase';
import { TimeUtils, Timer } from '../../utils/TimeUtils';
import { Utils } from '../../utils/Utils';
import { Mixin } from '../../utils/MixinManager';

class Controller extends ModuleBase {
    constructor() {
        super({
            name: 'Controller',
            subcategory: 'Core',
            description: 'Various toggles to improve peformance while game is minimized.',
            showEnabledToggle: false,
            hideInModules: true,
        });

        let sectionName = 'Macro Controllers';

        this.wasRunning = false;
        this.revertTrigger = null;

        this.AUTO_PERSPECTIVE = false;
        this.LIMIT_FPS = false;

        // this.currentDistance = Client.getMinecraft().options.viewDistance;

        this.addDirectToggle(
            'Auto-Perspective',
            (v) => this.handlePerspective(v),
            'Automatically switches to third person while macro is running.',
            false,
            sectionName
        );

        this.addDirectToggle('Limit FPS', (v) => this.handleFPS(v), 'Limits FPS while macro is running.', false, sectionName);

        this.addDirectMultiToggle(
            'Render Limiters',
            ['Off', 'Limit Chunks', 'No Render'],
            true,
            (v) => this.handleRenderingLimiter(v),
            'Limits render distance or cancels rendering while macro is running.',
            'Off',
            sectionName
        );
    }

    handleRenderingLimiter(value) {
        const v = value?.find?.((option) => option.enabled);
        Mixin.set('renderLimiter', v?.name || 'Off');
    }

    handlePerspective(value) {
        Mixin.set('forcePerspective', value);
    }

    handleFPS(value) {
        Mixin.set('limitFps', value);
    }
}

new Controller();
