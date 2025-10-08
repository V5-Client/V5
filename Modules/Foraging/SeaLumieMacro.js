import RendererMain from '../../Rendering/RendererMain';
import { Chat } from '../../Utility/Chat';
import { Color } from '../../Utility/Constants';
const { addCategoryItem, addToggle } = global.Categories;

class SeaLumie {
    constructor() {
        this.STATES = {
            WAITING: 0,
            SCANNING: 1,
            GOINGTO: 2,
            RESURFACING: 3,
        };

        this.state = this.STATES.WAITING;
        this.enabled = false;
        this.closestPickle = null;
        this.renderer = null;
        this.startedScan = false;
        this.tryBreak = false;
        this.hasBroken = false;

        register('tick', () => {
            if (!this.enabled) return;

            switch (this.state) {
                case this.STATES.SCANNING:
                    if (!this.startedScan) {
                        this.startedScan = true;

                        new Thread(() => {
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

                                let distance = Math.sqrt(
                                    Math.pow(currentBlock.x - playerX, 2) +
                                        Math.pow(currentBlock.y - playerY, 2) +
                                        Math.pow(currentBlock.z - playerZ, 2)
                                );
                                if (distance > radius) continue;

                                let key = `${currentBlock.x},${currentBlock.y},${currentBlock.z}`;
                                if (visited.has(key)) continue;
                                visited.add(key);

                                let block = World.getBlockAt(
                                    currentBlock.x,
                                    currentBlock.y,
                                    currentBlock.z
                                );

                                if (
                                    block?.type
                                        ?.getRegistryName()
                                        ?.includes('pickle')
                                ) {
                                    let blockAbove = World.getBlockAt(
                                        currentBlock.x,
                                        currentBlock.y + 1,
                                        currentBlock.z
                                    );
                                    if (
                                        blockAbove?.type
                                            ?.getRegistryName()
                                            ?.includes('water')
                                    ) {
                                        this.closestPickle = currentBlock;
                                        Chat.message(
                                            `Found the closest pickle using BFS at x=${this.closestPickle.x}, y=${this.closestPickle.y}, z=${this.closestPickle.z}`
                                        );
                                        this.hasBroken = false;
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
                                        let neighborBlock = World.getBlockAt(
                                            neighbor.x,
                                            neighbor.y,
                                            neighbor.z
                                        );
                                        if (
                                            neighborBlock?.type
                                                ?.getRegistryName()
                                                ?.includes('water') ||
                                            neighborBlock?.type
                                                ?.getRegistryName()
                                                ?.includes('air') ||
                                            neighborBlock?.type
                                                ?.getRegistryName()
                                                ?.includes('pickle')
                                        ) {
                                            // allow pathing through pickles
                                            queue.push(neighbor);
                                        }
                                    }
                                });
                            }

                            this.closestPickle = null;
                            Chat.message('Failed to find a pickle!');
                            this.startedScan = true; // retry
                            this.state = this.STATES.SCANNING;
                        }).start();
                    }
                    break;
                case this.STATES.GOINGTO:
                    if (Player.getAirLevel() <= 0) {
                        this.state = this.STATES.RESURFACING;
                        Chat.message('Ran out of air, resufacing');
                    }

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
          Chat.message(block);

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
                Chat.message("STILL");
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

        register('postRenderWorld', () => {
            if (this.enabled && this.closestPickle) {
                let waypointPos = new Vec3i(
                    this.closestPickle.x,
                    this.closestPickle.y,
                    this.closestPickle.z
                );

                RendererMain.drawWaypoint(
                    waypointPos,
                    false,
                    new Color(1, 0, 0, 1)
                );
            }
        });

        this.toggle = (value) => {
            this.enabled = value;
            if (value) this.state = this.STATES.SCANNING;
            else this.state = this.STATES.WAITING;
        };

        addCategoryItem(
            'Foraging',
            'Sea Lumie',
            'Automatically farms sea lumies',
            'Automatically farms sea lumies'
        );

        addToggle(
            'Modules',
            'Sea Lumie',
            'Enabled (REPLACE ME WITH A KEYBIND)',
            (value) => {
                this.toggle(value);
            },
            'Toggles the Sea Lumie macro'
        );
    }
}
new SeaLumie();
