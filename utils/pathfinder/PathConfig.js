import { ModuleBase } from '../ModuleBase';
import { File, globalAssetsDir } from '../Constants';

class PathFindingConfig extends ModuleBase {
    constructor() {
        super({
            name: 'Pathfinding',
            subcategory: 'Core',
            description: 'Pathfinding Utilities',
            tooltip: 'Pathfinding Utilities',
            hideInModules: true,
        });

        this.WARP_POINTS_DATA = this.loadWarpPoints();
        this.WARP_POINT_STATES = {};

        this.PATHFINDING_DEBUG = false;
        this.RENDER_KEY_NODES = false;
        this.RENDER_FLOATING_SPLINE = false;
        this.RENDER_LOOK_POINTS = false;
        this.PATHFINDER_MAX_COMPUTE = 500_000;

        this.addDirectToggle(
            'Pathfinding Debug',
            (value) => {
                this.PATHFINDING_DEBUG = value;
            },
            'Enables pathfinding debug mode',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Key Nodes',
            (value) => {
                this.RENDER_KEY_NODES = value;
            },
            'Renders the key nodes of the path',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Floating Spline',
            (value) => {
                this.RENDER_FLOATING_SPLINE = value;
            },
            'Renders the floating spline of the path',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'Render Look Points',
            (value) => {
                this.RENDER_LOOK_POINTS = value;
            },
            'Renders the look points of the path',
            false,
            'Pathfinding'
        );

        this.addDirectSlider(
            'Pathfinder Max Compute',
            500,
            5_000,
            500,
            (value) => {
                this.PATHFINDER_MAX_COMPUTE = Number(value) * 1_000;
            },
            'Maximum native pathfinder iterations before giving up.',
            'Pathfinding'
        );

        this.registerWarpPointSettings();
    }

    loadWarpPoints() {
        const warppointsloc = new File(globalAssetsDir, 'WarpPoints.json');
        const raw = FileLib.read(warppointsloc.getPath());
        try {
            const parsed = raw ? JSON.parse(raw) : null;
            const warps = Array.isArray(parsed?.warps) ? parsed.warps : [];
            return warps.map((warp) => ({
                warp: warp.warp,
                area: warp.area,
                defaultUnlock: !!warp.defaultUnlock,
                x: Number(warp.x),
                y: Number(warp.y),
                z: Number(warp.z),
            }));
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    registerWarpPointSettings() {
        this.WARP_POINTS_DATA.forEach((warpPoint) => {
            this.WARP_POINT_STATES[warpPoint.warp] = warpPoint.defaultUnlock;
        });

        const warpNames = this.WARP_POINTS_DATA.map((warpPoint) => warpPoint.warp);
        const defaultWarps = this.WARP_POINTS_DATA.filter((warpPoint) => warpPoint.defaultUnlock).map((warpPoint) => warpPoint.warp);

        this.addDirectMultiToggle(
            'Warp Points',
            warpNames,
            false,
            (value) => {
                this.toggleWarpPoint(value);
            },
            'Select which warps can be used as pathfinding start points',
            defaultWarps,
            'Pathfinding'
        );
    }

    toggleWarpPoint(value) {
        const enabledWarps = new Set();

        value.forEach((entry) => {
            if (entry.enabled) {
                enabledWarps.add(entry.name);
            }
        });

        this.WARP_POINTS_DATA.forEach((warpPoint) => {
            this.WARP_POINT_STATES[warpPoint.warp] = enabledWarps.has(warpPoint.warp);
        });
    }

    getAreaWarpPoints(area) {
        return this.WARP_POINTS_DATA.filter((warpPoint) => {
            if (!this.WARP_POINT_STATES[warpPoint.warp]) return false;
            return warpPoint.area === area;
        });
    }
}

const PathConfig = new PathFindingConfig();
export default PathConfig;
