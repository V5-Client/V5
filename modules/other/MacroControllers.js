import { ModuleBase } from '../../utils/ModuleBase';

const renderLimiters = {
    Off: Client.RenderLimiter.OFF,
    'Limit Chunks': Client.RenderLimiter.LIMIT_CHUNKS,
    'No Render': Client.RenderLimiter.NO_RENDER,
};

class Controller extends ModuleBase {
    constructor() {
        super({
            name: 'modules.controller.name',
            subcategory: 'Core',
            description: 'modules.controller.description',
            hideInModules: true,
        });

        let sectionName = 'Macro Controllers';

        this.addDirectToggle('labels.auto_perspective', (value) => Client.setForcePerspective(value), 'descriptions.auto_perspective', false, sectionName);

        this.addDirectToggle('labels.limit_fps', (value) => Client.setLimitFps(value), 'descriptions.limit_fps', false, sectionName);
        this.addDirectToggle('labels.mute_game', (value) => Client.setMuteGame(value), 'descriptions.mute_game', false, sectionName);

        this.addDirectMultiToggle(
            'labels.render_limiters',
            ['options.off', 'options.limit_chunks', 'options.no_render'],
            true,
            (value) => Client.setRenderLimiter(renderLimiters[value?.find?.((option) => option.enabled)?.name || 'Off']),
            'Limits render distance or cancels rendering while macro is running.',
            'Off',
            sectionName
        );
    }
}

new Controller();
