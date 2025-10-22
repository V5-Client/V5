// Centralized configuration for Pathfinding module
import { Chat } from '../Utility/Chat';

let renderKeyNodes = false;
let renderFloatingSpline = false;
let toggleSprint = false;
let pathfindingDebug = false;

export function getRenderKeyNodes() {
    return renderKeyNodes;
}

export function getRenderFloatingSpline() {
    return renderFloatingSpline;
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

export function setRenderFloatingSpline(value) {
    renderFloatingSpline = value;
}

export function setToggleSprint(value) {
    toggleSprint = value;
}

export function setPathfindingDebug(value) {
    pathfindingDebug = value;
}
