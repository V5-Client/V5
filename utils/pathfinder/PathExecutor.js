const tickCallbacks = [];
const stepCallbacks = [];
let tickRegister = null;
let stepRegister = null;

const runCallbacks = (callbacks, name) => {
    for (const callback of callbacks) {
        try {
            callback();
        } catch (error) {
            console.error(`PathExecutor ${name} callback error:`, error);
        }
    }
};

export function startPathExecutor() {
    destroyPathExecutor();
    tickRegister = register('tick', () => runCallbacks(tickCallbacks, 'tick'));
    stepRegister = register('step', () => runCallbacks(stepCallbacks, 'step')).setFps(120);
}

export function destroyPathExecutor() {
    tickRegister?.unregister();
    stepRegister?.unregister();
    tickRegister = null;
    stepRegister = null;
}

export function onPathTick(callback) {
    if (typeof callback === 'function') tickCallbacks.push(callback);
}

export function onPathStep(callback) {
    if (typeof callback === 'function') stepCallbacks.push(callback);
}
