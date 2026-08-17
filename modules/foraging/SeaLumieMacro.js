import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { calculateDistance } from '../../utils/Math';

class SeaLumie extends ModuleBase {
    constructor() {
        super({
            name: 'Sea Lumie',
            subcategory: 'Foraging',
            developerMode: true,
            description: 'Automatically farms sea lumies',
            tooltip: 'Automatically farms sea lumies',
            isMacro: true,
        });
        this.STATES = {
            WAITING: 0,
            SCANNING: 1,
            GOINGTO: 2,
            RESURFACING: 3,
        };

        this.state = this.STATES.WAITING;
        this.closestPickle = null;
        this.startedScan = false;
        this.scanQueue = [];
        this.scanHead = 0;
        this.scanVisited = new Set();
        this.scanCenter = null;
        this.scanIterations = 0;

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => Object.keys(this.STATES).find((key) => this.STATES[key] === this.state) || 'Unknown',
                    'Closest Pickle': () => (this.closestPickle ? `Found` : 'None'),
                },
            },
        ]);

        this.on('tick', () => {
            switch (this.state) {
                case this.STATES.SCANNING:
                    if (!this.startedScan) this.beginScan();
                    this.scanStep();
                    break;
                case this.STATES.GOINGTO:
                    if (Player.getAirLevel() <= 0) {
                        this.state = this.STATES.RESURFACING;
                        this.message('Ran out of air, resurfacing');
                    }
                    break;
                case this.STATES.RESURFACING:
                    if (Player.getAirLevel() > 0) {
                        this.startedScan = false;
                        this.state = this.STATES.SCANNING;
                    }
                    break;

                /* Rotations.lookAtVector([
            this.closestPickle.x,
            this.closestPickle.y,
            this.closestPickle.z,
          ]);

          let block = World.getBlockAt(
            this.closestPickle.x,
            this.closestPickle.y,
            this.closestPickle.z
          );
          this.message(block);

          if (block?.type?.getRegistryName()?.includes("pickle")) {
            // get if the block iss still there
            if (
              calculateDistance(
                [Player.getX(), Player.getY(), Player.getZ()],
                [
                  this.closestPickle.x,
                  this.closestPickle.y,
                  this.closestPickle.z,
                ]
              ).distance > 4
            ) {
              Client.setKey("w", true);
            } else {
              let looking = Player.lookingAt();

              if (looking?.type?.getRegistryName()?.includes("pickle")) {
                this.message("STILL");
                Client.setKey("leftclick", true); // this instead of leftclick so you  dont do 50cps
              } else {
                Client.setKey("leftclick", false);
              }
              Client.setKey("w", false);
            }
          } else {
            this.startedScan = false;
            this.state = this.STATES.SCANNING;
          } **/
            }
        });

        this.on('postRenderWorld', () => {
            if (this.closestPickle) {
                let waypointPos = new Vec3d(this.closestPickle.x, this.closestPickle.y, this.closestPickle.z);

                Render3D.drawFilledBox(waypointPos, new RenderColor(255, 0, 0, 255));
            }
        });
    }

    beginScan() {
        this.startedScan = true;
        this.scanCenter = {
            x: Math.floor(Player.getX()),
            y: Math.floor(Player.getY()),
            z: Math.floor(Player.getZ()),
        };
        this.scanQueue = [this.scanCenter];
        this.scanHead = 0;
        this.scanVisited = new Set();
        this.scanIterations = 0;
    }

    scanStep() {
        const radius = 64;
        const maxIterations = radius * radius * radius * 8;
        const offsets = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];

        // ponytail: bounded main-thread scan; snapshot chunks if this developer macro needs faster searches.
        for (let budget = 100; budget > 0 && this.scanHead < this.scanQueue.length && this.scanIterations < maxIterations; budget--) {
            const current = this.scanQueue[this.scanHead++];
            this.scanIterations++;
            if (Math.hypot(current.x - this.scanCenter.x, current.y - this.scanCenter.y, current.z - this.scanCenter.z) > radius) continue;

            const key = `${current.x},${current.y},${current.z}`;
            if (this.scanVisited.has(key)) continue;
            this.scanVisited.add(key);

            const registryName = World.getBlockAt(current.x, current.y, current.z)?.type?.getRegistryName();
            if (
                registryName?.includes('pickle') &&
                World.getBlockAt(current.x, current.y + 1, current.z)
                    ?.type?.getRegistryName()
                    ?.includes('water')
            ) {
                this.closestPickle = current;
                this.message(`Found the closest pickle using BFS at x=${current.x}, y=${current.y}, z=${current.z}`);
                this.state = this.STATES.GOINGTO;
                return;
            }

            for (const [dx, dy, dz] of offsets) {
                const neighbor = {
                    x: current.x + dx,
                    y: current.y + dy,
                    z: current.z + dz,
                };
                const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                if (this.scanVisited.has(neighborKey)) continue;
                const neighborName = World.getBlockAt(neighbor.x, neighbor.y, neighbor.z)?.type?.getRegistryName();
                if (neighborName?.includes('water') || neighborName?.includes('air') || neighborName?.includes('pickle')) this.scanQueue.push(neighbor);
            }
        }

        if (this.scanHead < this.scanQueue.length && this.scanIterations < maxIterations) return;
        this.closestPickle = null;
        this.message('Failed to find a pickle!');
        this.startedScan = false;
    }

    onEnable() {
        this.closestPickle = null;
        this.startedScan = false;
        this.state = this.STATES.SCANNING;
    }

    onDisable() {
        this.closestPickle = null;
        this.startedScan = false;
        this.scanQueue = [];
        this.scanVisited.clear();
        this.state = this.STATES.WAITING;
    }
}
if (isDeveloperModeEnabled()) new SeaLumie();
