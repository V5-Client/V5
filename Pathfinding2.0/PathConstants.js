import './PathCommands';
import './Connection';
import { ModuleBase } from '../Utility/ModuleBase';
import {
    setRenderKeyNodes,
    setToggleSprint,
    setPathfindingDebug,
} from './PathConfig';

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
            'Toggle Sprint',
            (value) => {
                setToggleSprint(value);
            },
            'Toggles sprinting while walking'
        );
    }
}

new PathRegistry();

// These are the default values for the pathfinding API, if configured by player thats their problem.
// will be added once the pathfinding API is fully implemented
export const ROTATION_CONSTANTS = {};
