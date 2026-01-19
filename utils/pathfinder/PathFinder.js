import { ModuleBase } from '../../utils/ModuleBase';
import { setPathfindingDebug, setRenderKeyNodes, setRenderFloatingSpline } from './PathConfig';

import './PathAPI';

class PathRegistry extends ModuleBase {
    constructor() {
        super({
            name: 'Pathfinding',
            subcategory: 'Core',
            description: 'Pathfinding Utilities',
            tooltip: 'Pathfinding Utilities',
            showEnabledToggle: false,
            hideInModules: true,
        });

        this.addDirectToggle(
            'Pathfinding Debug',
            (value) => {
                setPathfindingDebug(value);
            },
            'Enables pathfinding debug mode',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Key Nodes',
            (value) => {
                setRenderKeyNodes(value);
            },
            'Renders the key nodes of the path',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Floating Spline',
            (value) => {
                setRenderFloatingSpline(value);
            },
            'Renders the floating spline of the path',
            false,
            'Pathfinding'
        );
    }
}

new PathRegistry();
