class Executor {
    constructor() {
        this.tickCallbacks = [];
        this.stepCallbacks = [];

        this.tickRegister = null;
        this.stepRegister = null;
    }

    execute() {
        this.tickRegister = register('tick', () => {
            this.tickCallbacks.forEach((callback) => callback());
        });

        this.stepRegister = register('step', () => {
            this.stepCallbacks.forEach((callback) => callback());
        }).setFps(120);
    }

    destroy() {
        if (this.tickRegister) this.tickRegister.unregister();
        if (this.stepRegister) this.stepRegister.unregister();
        this.tickRegister = null;
        this.stepRegister = null;
    }

    onTick(callback) {
        this.tickCallbacks.push(callback.bind(this));
    }

    onStep(callback) {
        this.stepCallbacks.push(callback.bind(this));
    }
}

export const PathExecutor = new Executor();
