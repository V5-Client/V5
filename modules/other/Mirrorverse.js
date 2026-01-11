import { Chat } from '../../utils/Chat';
import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Rotations } from '../../utils/player/Rotations';
import { Utils } from '../../utils/Utils';
import RenderUtils from '../../utils/render/RendererUtils';
import { Keybind } from '../../utils/player/Keybinding';

class Mirrorverse extends ModuleBase {
    constructor() {
        super({
            name: 'Mirrorverse',
            subcategory: 'Other',
        });

        this.isInRift = false;
        this.currentIndex = 0;
        this.wasOnGround = true;
        this.mazeBlocks = [
            { x: -82, y: 52, z: -112, direction: 'START' },
            { x: -86, y: 52, z: -112, direction: 'FORWARD' },
            { x: -86, y: 52, z: -115, direction: 'RIGHT' },
            { x: -88, y: 52, z: -115, direction: 'FORWARD' },
            { x: -88, y: 52, z: -110, direction: 'LEFT' },
            { x: -86, y: 52, z: -110, direction: 'BACKWARD' },
            { x: -86, y: 52, z: -109, direction: 'LEFT' },
        ];

        this.failed = [];
        this.poses = [
            { x: -125, y: 39, z: -108 }, //1
            { x: -129, y: 39, z: -108 }, //2
            { x: -133, y: 40, z: -108 }, //3
            { x: -137, y: 39, z: -103 }, //4
            { x: -133, y: 40, z: -100 }, //5
            { x: -137, y: 41, z: -96 }, //6
            { x: -141, y: 42, z: -100 }, //7
            { x: -145, y: 40, z: -104 }, //8
            { x: -145, y: 40, z: -108 }, //9
            { x: -142, y: 42, z: -112 }, //10
            { x: -137, y: 40, z: -117 }, //11
            { x: -134, y: 40, z: -120 }, //12
            { x: -137, y: 41, z: -124 }, //13
            { x: -141, y: 41, z: -121 }, //14
            { x: -145, y: 42, z: -117 }, //15
            { x: -149, y: 43, z: -113 }, //16
            { x: -153, y: 42, z: -109 }, //17
            { x: -157, y: 41, z: -105 }, //18
            { x: -154, y: 40, z: -101 }, //19
            { x: -157, y: 40, z: -97 }, //20
            { x: -162, y: 39, z: -92 }, //21
            { x: -166, y: 40, z: -97 }, //22
            { x: -166, y: 41, z: -100 }, //23
            { x: -165, y: 42, z: -104 }, //24
            { x: -165, y: 43, z: -109 }, //25
            { x: -161, y: 42, z: -113 }, //26
            { x: -158, y: 39, z: -116 }, //27
            { x: -161, y: 40, z: -120 }, //28
            { x: -166, y: 41, z: -125 }, //29
            { x: -169, y: 41, z: -121 }, //30
            { x: -169, y: 42, z: -117 }, //31
            { x: -173, y: 43, z: -113 }, //32
            { x: -173, y: 43, z: -109 }, //33
            { x: -177, y: 40, z: -105 }, //34
            { x: -173, y: 41, z: -100 }, //35
            { x: -173, y: 41, z: -97 }, //36
            { x: -178, y: 39, z: -92 }, //37
            { x: -182, y: 40, z: -96 }, //38
            { x: -185, y: 41, z: -100 }, //39
            { x: -181, y: 42, z: -104 }, //40
            { x: -185, y: 41, z: -108 }, //41
            { x: -182, y: 40, z: -112 }, //42
            { x: -185, y: 41, z: -116 }, //43
            { x: -182, y: 40, z: -120 }, //44
            { x: -185, y: 41, z: -124 }, //45
            { x: -189, y: 42, z: -121 }, //46
            { x: -189, y: 43, z: -117 }, //47
            { x: -189, y: 43, z: -113 }, //48
            { x: -193, y: 41, z: -109 }, //49
            { x: -193, y: 42, z: -105 }, //50
            { x: -190, y: 43, z: -101 }, //51
            { x: -193, y: 42, z: -97 }, //52
            { x: -197, y: 39, z: -93 }, //53
            { x: -201, y: 40, z: -96 }, //54
            { x: -205, y: 41, z: -100 }, //55
            { x: -209, y: 42, z: -104 }, //56
            { x: -206, y: 43, z: -108 }, //57
            { x: -202, y: 43, z: -108 }, //58
            { x: -198, y: 43, z: -112 }, //59
            { x: -201, y: 40, z: -116 }, //60
            { x: -205, y: 41, z: -116 }, //61
            { x: -205, y: 42, z: -120 }, //62
            { x: -209, y: 43, z: -121 }, //63
            { x: -213, y: 41, z: -117 }, //64
            { x: -213, y: 41, z: -113 }, //65
            { x: -217, y: 42, z: -109 }, //66
            { x: -221, y: 43, z: -105 }, //67
        ];

        this.on('step', () => {
            if (Utils.area() === 'The Rift') this.isInRift = true;
            else this.isInRift = false;
        });
        this.isEdgeRegistered = false;
        this.on('postRenderWorld', () => {
            this.poses.forEach((pose, index) => {
                if (index === this.currentIndex) {
                    RenderUtils.drawBox(new Vec3d(pose.x, pose.y, pose.z), [0, 255, 0, 150], false);
                } else if (pose.passed) {
                    RenderUtils.drawBox(new Vec3d(pose.x, pose.y, pose.z), [255, 0, 0, 50], false);
                } else {
                    RenderUtils.drawBox(new Vec3d(pose.x, pose.y, pose.z), [100, 100, 55, 100], false);
                }
            });

            this.mazeBlocks.forEach((block, index) => {
                if (block.direction === 'START') {
                    RenderUtils.drawBox(new Vec3d(block.x, block.y, block.z), [0, 255, 0, 150], false);
                } else if (block.direction === 'FORWARD') {
                    RenderUtils.drawBox(new Vec3d(block.x, block.y, block.z), [255, 0, 0, 50], false);
                } else if (block.direction === 'RIGHT') {
                    RenderUtils.drawBox(new Vec3d(block.x, block.y, block.z), [100, 100, 55, 100], false);
                } else if (block.direction === 'LEFT') {
                    RenderUtils.drawBox(new Vec3d(block.x, block.y, block.z), [100, 100, 55, 100], false);
                } else if (block.direction === 'BACKWARD') {
                    RenderUtils.drawBox(new Vec3d(block.x, block.y, block.z), [100, 100, 55, 100], false);
                }
            });
            this.checkPassedWaypoints();
        });

        this.on('chat', () => {
            this.resetWaypoints();
            this.failed = [];
        }).setCriteria('OH NO! THE LAVA OOFED YOU BACK TO THE START!');

        this.edge = register('renderOverlay', () => {
            this.isEdgeRegistered = true;
            let ID = World.getBlockAt(Player.getX(), Player.getY() - 0.1, Player.getZ()).type.getID();
            let id2 = World.getBlockAt(Player.getX(), Player.getY() - 1, Player.getZ()).type.getID();
            if (id2 == 36) {
                Chat.messageDebug('failed jump at ' + this.currentIndex);
                if (!this.failed.includes(this.currentIndex)) this.failed.push(this.currentIndex);
            }
            if (ID == 0) {
                this.jump();
                this.isEdgeRegistered = false;
                this.edge.unregister();
            }
        }).unregister();

        this.on('command', (type) => {
            this.mazeBlocks.push({ x: Player.getX().toFixed(0), y: Player.getY().toFixed(0), z: Player.getZ().toFixed(0), direction: type });
            console.log(`${JSON.stringify(this.mazeBlocks)}\n\n\n`);
        }).setName('mazeadd');

        this.on('command', (args) => {
            this.currentIndex = args;
        }).setName('index');
    }

    isInRift() {
        return this.isInRift;
    }

    getCurrentPos() {
        if (this.currentIndex < this.poses.length) {
            return this.poses[this.currentIndex];
        }
        return null;
    }

    jump() {
        Keybind.setKey('space', true);
        Client.scheduleTask(1, () => {
            Keybind.setKey('space', false);
        });
    }

    checkPassedWaypoints() {
        if (!this.isInRift) return;
        if (!this.isEdgeRegistered) this.edge.register();
        const player = Player.asPlayerMP();
        const px = player.getX();
        const py = player.getY();
        const pz = player.getZ();
        const isOnGround = player.isOnGround();
        const justLanded = !this.wasOnGround && isOnGround;
        this.wasOnGround = isOnGround;

        const currentPos = this.getCurrentPos();
        if (!currentPos) return;

        if (justLanded) {
            Rotations.rotateToVector(new Vec3d(currentPos.x, currentPos.y + 1, currentPos.z), false, 3);
        }

        const dx = px - currentPos.x;
        const dy = py - currentPos.y;
        const dz = pz - currentPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < 2) {
            currentPos.passed = true;
            this.currentIndex++;
            Chat.messageDebug(`index: ${this.currentIndex}`);

            const nextPos = this.getCurrentPos();
            if (nextPos) {
                Rotations.rotateToVector(new Vec3d(nextPos.x, nextPos.y + 1, nextPos.z), false, 3);
            } else {
                Chat.message('mirrorverse completed!');
                Chat.message('failed jumps: ' + JSON.stringify(this.failed));
                Client.copy(JSON.stringify(this.failed));
            }
        }
    }

    resetWaypoints() {
        this.currentIndex = 0;
        this.wasOnGround = true;
        this.poses.forEach((pose) => {
            pose.passed = false;
        });
    }
}

new Mirrorverse();
