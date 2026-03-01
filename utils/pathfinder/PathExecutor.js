class Executor {
    constructor() {
        this.tickCallbacks = [];
        this.stepCallbacks = [];

        this.tickRegister = null;
        this.stepRegister = null;
    }

    execute() {
        this.destroy();

        this.tickRegister = register('tick', () => {
            for (let i = 0; i < this.tickCallbacks.length; i++) {
                const callback = this.tickCallbacks[i];
                if (typeof callback !== 'function') continue;
                try {
                    callback();
                } catch (e) {
                    console.error('PathExecutor tick callback error:', e);
                }
            }
        });

        this.stepRegister = register('step', () => {
            for (let i = 0; i < this.stepCallbacks.length; i++) {
                const callback = this.stepCallbacks[i];
                if (typeof callback !== 'function') continue;
                try {
                    callback();
                } catch (e) {
                    console.error('PathExecutor step callback error:', e);
                }
            }
        }).setFps(120);
    }

    destroy() {
        if (this.tickRegister) this.tickRegister.unregister();
        if (this.stepRegister) this.stepRegister.unregister();
        this.tickRegister = null;
        this.stepRegister = null;
    }

    onTick(callback) {
        if (typeof callback === 'function') {
            this.tickCallbacks.push(callback);
        }
    }

    onStep(callback) {
        if (typeof callback === 'function') {
            this.stepCallbacks.push(callback);
        }
    }
}

export const PathExecutor = new Executor();
