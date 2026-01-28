import { ModuleBase } from '../ModuleBase';

class PathFindingConfig extends ModuleBase {
    constructor() {
        super({
            name: 'Pathfinding',
            subcategory: 'Core',
            description: 'Pathfinding Utilities',
            tooltip: 'Pathfinding Utilities',
            showEnabledToggle: false,
            hideInModules: true,
        });

        this.PATHFINDING_DEBUG = false;
        this.RENDER_KEY_NODES = false;
        this.RENDER_FLOATING_SPLINE = false;
        this.RENDER_LOOK_POINTS = false;

        this.addDirectToggle(
            'Pathfinding Debug',
            (value) => {
                this.PATHFINDING_DEBUG = value;
            },
            'Enables pathfinding debug mode',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Key Nodes',
            (value) => {
                this.RENDER_KEY_NODES = value;
            },
            'Renders the key nodes of the path',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Floating Spline',
            (value) => {
                this.RENDER_FLOATING_SPLINE = value;
            },
            'Renders the floating spline of the path',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Look Points',
            (value) => {
                this.RENDER_LOOK_POINTS = value;
            },
            'Renders the look points of the path',
            false,
            'Pathfinding'
        );
    }
}

const PathConfig = new PathFindingConfig();
export default PathConfig;
