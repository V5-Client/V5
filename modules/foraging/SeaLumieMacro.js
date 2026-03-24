//@VIP
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import Render from '../../utils/render/Render';

class SeaLumie extends ModuleBase {
    constructor() {
        super({
            name: 'Sea Lumie',
            subcategory: 'Foraging',
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
                    if (!this.startedScan) {
                        this.startedScan = true;

                        const scanThread = new java.lang.Thread(() => {
                            let queue = [
                                {
                                    x: Math.floor(Player.getX()),
                                    y: Math.floor(Player.getY()),
                                    z: Math.floor(Player.getZ()),
                                },
                            ];

                            let visited = new Set();
                            let radius = 64;

                            let playerX = Math.floor(Player.getX());
                            let playerY = Math.floor(Player.getY());
                            let playerZ = Math.floor(Player.getZ());

                            let count = 0;
                            let maxIterations = radius * radius * radius * 8;

                            while (queue.length > 0 && count < maxIterations) {
                                let currentBlock = queue.shift();
                                count++;

                                let distance = Math.hypot(currentBlock.x - playerX, currentBlock.y - playerY, currentBlock.z - playerZ);
                                if (distance > radius) continue;

                                let key = `${currentBlock.x},${currentBlock.y},${currentBlock.z}`;
                                if (visited.has(key)) continue;
                                visited.add(key);

                                let block = World.getBlockAt(currentBlock.x, currentBlock.y, currentBlock.z);

                                if (block?.type?.getRegistryName()?.includes('pickle')) {
                                    let blockAbove = World.getBlockAt(currentBlock.x, currentBlock.y + 1, currentBlock.z);
                                    if (blockAbove?.type?.getRegistryName()?.includes('water')) {
                                        this.closestPickle = currentBlock;
                                        this.message(
                                            `Found the closest pickle using BFS at x=${this.closestPickle.x}, y=${this.closestPickle.y}, z=${this.closestPickle.z}`
                                        );
                                        this.state = this.STATES.GOINGTO;
                                        return;
                                    }
                                }

                                let neighbors = [
                                    {
                                        x: currentBlock.x + 1,
                                        y: currentBlock.y,
                                        z: currentBlock.z,
                                    },
                                    {
                                        x: currentBlock.x - 1,
                                        y: currentBlock.y,
                                        z: currentBlock.z,
                                    },
                                    {
                                        x: currentBlock.x,
                                        y: currentBlock.y + 1,
                                        z: currentBlock.z,
                                    },
                                    {
                                        x: currentBlock.x,
                                        y: currentBlock.y - 1,
                                        z: currentBlock.z,
                                    },
                                    {
                                        x: currentBlock.x,
                                        y: currentBlock.y,
                                        z: currentBlock.z + 1,
                                    },
                                    {
                                        x: currentBlock.x,
                                        y: currentBlock.y,
                                        z: currentBlock.z - 1,
                                    },
                                ];

                                neighbors.forEach((neighbor) => {
                                    let neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                                    if (!visited.has(neighborKey)) {
                                        let neighborBlock = World.getBlockAt(neighbor.x, neighbor.y, neighbor.z);
                                        if (
                                            neighborBlock?.type?.getRegistryName()?.includes('water') ||
                                            neighborBlock?.type?.getRegistryName()?.includes('air') ||
                                            neighborBlock?.type?.getRegistryName()?.includes('pickle')
                                        ) {
                                            // allow pathing through pickles
                                            queue.push(neighbor);
                                        }
                                    }
                                });
                            }

                            this.closestPickle = null;
                            this.message('Failed to find a pickle!');
                            this.startedScan = false;
                            this.state = this.STATES.SCANNING;
                        });
                        scanThread.setDaemon(true);
                        scanThread.start();
                    }
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

                /* Rotations.rotateTo([
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
              MathUtils.calculateDistance(
                [Player.getX(), Player.getY(), Player.getZ()],
                [
                  this.closestPickle.x,
                  this.closestPickle.y,
                  this.closestPickle.z,
                ]
              ).distance > 4
            ) {
              Keybind.setKey("w", true);
            } else {
              let looking = Player.lookingAt();

              if (looking?.type?.getRegistryName()?.includes("pickle")) {
                this.message("STILL");
                Keybind.setKey("leftclick", true); // this instead of leftclick so you  dont do 50cps
              } else {
                Keybind.setKey("leftclick", false);
              }
              Keybind.setKey("w", false);
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

                Render.drawBox(waypointPos, Render.Color(255, 0, 0, 255));
            }
        });
    }

    onEnable() {
        this.closestPickle = null;
        this.startedScan = false;
        this.state = this.STATES.SCANNING;
    }

    onDisable() {
        this.closestPickle = null;
        this.startedScan = false;
        this.state = this.STATES.WAITING;
    }
}
new SeaLumie();
