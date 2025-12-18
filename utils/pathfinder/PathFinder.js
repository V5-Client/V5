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
        });

        this.addToggle(
            'Pathfinding Debug',
            (value) => {
                setPathfindingDebug(value);
            },
            'Enables pathfinding debug mode'
        );

        this.addToggle(
            'Render Key Nodes',
            (value) => {
                setRenderKeyNodes(value);
            },
            'Renders the key nodes of the path'
        );

        this.addToggle(
            'Render Floating Spline',
            (value) => {
                setRenderFloatingSpline(value);
            },
            'Renders the floating spline of the path'
        );
    }
}

new PathRegistry();
