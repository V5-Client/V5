// Centralized configuration for Pathfinding module
import { Chat } from '../Utility/Chat';
import { ModuleBase } from '../Utility/ModuleBase';

import './PathCommands';
import './Connection';

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

let renderKeyNodes = false;
let toggleSprint = false;
let pathfindingDebug = false;

export function getRenderKeyNodes() {
    return renderKeyNodes;
}

export function getToggleSprint() {
    return toggleSprint;
}
export function getPathfindingDebug() {
    return pathfindingDebug;
}

export function PathfindingMessages(msg) {
    if (!getPathfindingDebug()) return;
    Chat.message('&7Pathfinder: ' + msg);
}

export function setRenderKeyNodes(value) {
    renderKeyNodes = value;
}

export function setToggleSprint(value) {
    toggleSprint = value;
}

export function setPathfindingDebug(value) {
    pathfindingDebug = value;
}
