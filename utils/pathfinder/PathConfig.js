import { ModuleBase } from '../ModuleBase';
import { File, globalAssetsDir } from '../Constants';

class PathFindingConfig extends ModuleBase {
    constructor() {
        super({
            name: 'modules.pathfinding.name',
            subcategory: 'Core',
            description: 'modules.pathfinding.description',
            tooltip: 'modules.pathfinding.tooltip',
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
            'labels.pathfinding_debug',
            (value) => {
                this.PATHFINDING_DEBUG = value;
            },
            'descriptions.pathfinding_debug',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'labels.render_key_nodes',
            (value) => {
                this.RENDER_KEY_NODES = value;
            },
            'descriptions.render_key_nodes',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'labels.render_floating_spline',
            (value) => {
                this.RENDER_FLOATING_SPLINE = value;
            },
            'descriptions.render_floating_spline',
            false,
            'Pathfinding'
        );

        this.addDirectToggle(
            'labels.render_look_points',
            (value) => {
                this.RENDER_LOOK_POINTS = value;
            },
            'descriptions.render_look_points',
            false,
            'Pathfinding'
        );

        this.addDirectSlider(
            'labels.pathfinder_max_compute',
            500,
            5_000,
            500,
            (value) => {
                this.PATHFINDER_MAX_COMPUTE = Number(value) * 1_000;
            },
            'descriptions.pathfinder_max_compute',
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
            'labels.warp_points',
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
