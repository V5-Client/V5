class RouteState {
    constructor() {
        this.route = null;
        this.currentIndex = 0;
        this.macroName = null;
        this.isActive = false;
        this._listeners = [];
    }

    setRoute(route, macroName) {
        this.route = route;
        this.macroName = macroName;
        this.currentIndex = 0;
        this.isActive = !!route?.length;
    }

    clearRoute() {
        this.route = null;
        this.currentIndex = 0;
        this.macroName = null;
        this.isActive = false;
    }

    onChange(listener) {
        if (typeof listener === 'function') this._listeners.push(listener);
    }

    notifyChange(folder, name, extra) {
        const change = { folder, name, ...(extra && typeof extra === 'object' ? extra : {}) };
        this._listeners.forEach((listener) => {
            try {
                listener(change);
            } catch (error) {
                console.error('[RouteState] notifyChange listener failed:', error);
            }
        });
    }
}

const routeState = new RouteState();

export { routeState };
export default routeState;
