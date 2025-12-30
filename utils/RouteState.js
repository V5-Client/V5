class RouteState {
    constructor() {
        this.route = null;
        this.currentIndex = 0;
        this.macroName = null;
        this.isActive = false;
    }

    setRoute(route, macroName) {
        this.route = route;
        this.macroName = macroName;
        this.currentIndex = 0;
        this.isActive = route && route.length > 0;
    }

    setCurrentIndex(index) {
        this.currentIndex = index;
    }

    clearRoute() {
        this.route = null;
        this.currentIndex = 0;
        this.macroName = null;
        this.isActive = false;
    }

    getRoute() {
        return this.route;
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    hasActiveRoute() {
        return this.isActive && this.route && this.route.length > 0;
    }

    getUpcomingWaypoints(count = 5) {
        if (!this.route) return [];
        const start = this.currentIndex;
        const end = Math.min(start + count, this.route.length);
        return this.route.slice(start, end);
    }
}

if (!global.RouteState) {
    global.RouteState = new RouteState();
}

export default global.RouteState;
