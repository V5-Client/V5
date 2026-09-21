import { ModuleBase } from '../../utils/ModuleBase';

const renderLimiters = {
    Off: Client.RenderLimiter.OFF,
    'Limit Chunks': Client.RenderLimiter.LIMIT_CHUNKS,
    'No Render': Client.RenderLimiter.NO_RENDER,
};

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
            (value) => Client.setForcePerspective(value),
            'Automatically switches to third person while macro is running.',
            false,
            sectionName
        );

        this.addDirectToggle('Limit FPS', (value) => Client.setLimitFps(value), 'Limits FPS while macro is running.', false, sectionName);
        this.addDirectToggle('Mute Game', (value) => Client.setMuteGame(value), 'Mutes game audio while macro is running.', false, sectionName);

        this.addDirectMultiToggle(
            'Render Limiters',
            ['Off', 'Limit Chunks', 'No Render'],
            true,
            (value) => Client.setRenderLimiter(renderLimiters[value?.find?.((option) => option.enabled)?.name || 'Off']),
            'Limits render distance or cancels rendering while macro is running.',
            'Off',
            sectionName
        );
    }
}

new Controller();
