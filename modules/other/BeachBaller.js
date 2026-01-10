import RenderUtils from '../../utils/render/RendererUtils';
import { Chat } from '../../utils/Chat';
import { Vec3d, ArmorStandEntity } from '../../utils/Constants';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { MathUtils } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { Rotations } from '../../utils/player/Rotations';

const SMALL_BEACHBALL_BASE64 =
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjQyNzQ4ODAwNCwKICAicHJvZmlsZUlkIiA6ICIzN2JhNjRkYzkxOTg0OGI4YjZhNDdiYTg0ZDgwNDM3MCIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb3lLb3NhIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzJhZGY5ZDcxMzY3Y2Q2ZTUwNWZiNDhjYWFhNWFjZGNkZmYyYTA5ZjY2YzQ4OGRhZjA0ZDA0NWVlMGJmNTI4ZTEiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==';

const LARGE_BEACHBALL_BASE64 = 'I CANT FUCKING FIND IT CUZ IM STUPID :(';

const States = {
    WAITING: 0,
    BOUNCE: 1,
    RETURN: 2,
    PLACE: 3,
};

const TRAIL_MAX_POINTS = 30;
const PREDICTION_STEPS = 100;
const GRAVITY = 0.03;
const DRAG = 0.99; // these are completely arbitrary that came to me in a dream
const HEAD_HEIGHT_OFFSET = 1.8;

class Beachballer extends ModuleBase {
    constructor() {
        super({
            name: 'Beachballer',
            subcategory: 'Other',
            description: 'Automatically bounces beach balls',
            tooltip: 'Bounces beach balls and returns to start position at 40 bounces',
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.bounceCount = 0;
        this.tickCounter = 0;
        this.bounceTimer = 0;
        this.startPos = [0, 0, 0];
        this.state = States.WAITING;
        this.trackedBall = null;

        this.trailHistory = [];
        this.predictedPath = [];
        this.landingPoint = null;
        this.lastVelocityY = 0;
        this.ballDescending = false;

        this.on('tick', () => {
            if (Client.isInGui() && !Client.isInChat()) {
                this.toggle(false);
                return;
            }

            this.updateTrajectory();

            switch (this.state) {
                case States.WAITING:
                    break;

                case States.BOUNCE:
                    this.handleBounceState();
                    break;

                case States.RETURN:
                    this.handleReturnState();
                    break;

                case States.PLACE:
                    this.handlePlaceState();
                    break;
            }
        });

        this.on('renderWorld', () => {
            if (this.state === States.WAITING) return;
            this.renderTrajectory();
        });

        this.on('actionBar', (text) => {
            const clean = ChatLib.removeFormatting(text);
            const match = clean.match(/Bounces: (\d{1,3})/);

            if (match) {
                this.bounceCount = parseInt(match[1]);
                this.bounceTimer = Date.now();
            }

            if (Date.now() - this.bounceTimer > 2000) {
                this.bounceCount = 0;
            }
        }).setCriteria('${text}');
    }

    updateTrajectory() {
        if (!this.trackedBall || this.trackedBall.isDead()) {
            this.trailHistory = [];
            this.predictedPath = [];
            this.landingPoint = null;
            this.ballDescending = false;
            return;
        }

        const currentPos = {
            x: this.trackedBall.getX(),
            y: this.trackedBall.getY(),
            z: this.trackedBall.getZ(),
        };

        const velocity = {
            x: currentPos.x - this.trackedBall.getLastX(),
            y: currentPos.y - this.trackedBall.getLastY(),
            z: currentPos.z - this.trackedBall.getLastZ(),
        };

        if (this.lastVelocityY > 0 && velocity.y <= 0) {
            Client.scheduleTask(5, () => {
                // low speed = bad prediction
                this.ballDescending = true;
            });
        }
        // bounced
        if (velocity.y > 0.1) {
            this.ballDescending = false;
        }
        this.lastVelocityY = velocity.y;

        this.trailHistory.push(new Vec3d(currentPos.x, currentPos.y, currentPos.z));

        if (this.trailHistory.length > TRAIL_MAX_POINTS) {
            this.trailHistory.shift();
        }

        if (this.ballDescending && velocity.y <= 0) {
            const prediction = this.predictParabola(currentPos, velocity);
            this.predictedPath = prediction.path;
            this.landingPoint = prediction.landing;
        } else {
            this.predictedPath = this.simpleExtrapolation(currentPos, velocity);
            this.landingPoint = null;
        }
    }

    simpleExtrapolation(startPos, velocity) {
        // Just show ~10 ticks of where ball is heading, no physics
        const path = [];
        let x = startPos.x;
        let y = startPos.y;
        let z = startPos.z;

        path.push(new Vec3d(x, y, z));

        for (let i = 0; i < 10; i++) {
            x += velocity.x;
            y += velocity.y;
            z += velocity.z;
            path.push(new Vec3d(x, y, z));
        }

        return path;
    }

    predictParabola(startPos, velocity) {
        const path = [];
        let x = startPos.x;
        let y = startPos.y;
        let z = startPos.z;
        let vx = velocity.x;
        let vy = velocity.y;
        let vz = velocity.z;
        let landing = null;

        path.push(new Vec3d(x, y, z));

        const bounceY = Player.getY() + HEAD_HEIGHT_OFFSET;

        for (let i = 0; i < PREDICTION_STEPS; i++) {
            const prevY = y;

            vy -= GRAVITY;
            vx *= DRAG;
            vy *= DRAG;
            vz *= DRAG;

            x += vx;
            y += vy;
            z += vz;

            path.push(new Vec3d(x, y, z));

            if (vy < 0 && prevY > bounceY && y <= bounceY) {
                const t = (prevY - bounceY) / (prevY - y);
                const landX = path[path.length - 2].x + t * (x - path[path.length - 2].x);
                const landZ = path[path.length - 2].z + t * (z - path[path.length - 2].z);

                landing = new Vec3d(landX, bounceY, landZ);
                break;
            }

            if (y < bounceY - 10) break;
        }

        return { path, landing };
    }

    renderTrajectory() {
        const TRAIL_COLOR = [0, 255, 255, 200];
        const PREDICTION_COLOR = [255, 165, 0, 200];
        const LANDING_COLOR = [50, 255, 50, 255];
        const LINE_THICKNESS = 3;

        // past trail
        if (this.trailHistory.length >= 2) {
            for (let i = 0; i < this.trailHistory.length - 1; i++) {
                const start = this.trailHistory[i];
                const end = this.trailHistory[i + 1];

                const alpha = Math.floor(80 + (120 * i) / this.trailHistory.length);
                const fadedColor = [TRAIL_COLOR[0], TRAIL_COLOR[1], TRAIL_COLOR[2], alpha];

                RenderUtils.drawLine(start, end, fadedColor, LINE_THICKNESS, true);
            }
        }

        // predicted path
        if (this.predictedPath.length >= 2) {
            for (let i = 0; i < this.predictedPath.length - 1; i++) {
                const start = this.predictedPath[i];
                const end = this.predictedPath[i + 1];

                const alpha = Math.floor(200 * (1 - i / this.predictedPath.length));
                const fadedColor = [PREDICTION_COLOR[0], PREDICTION_COLOR[1], PREDICTION_COLOR[2], alpha];

                RenderUtils.drawLine(start, end, fadedColor, LINE_THICKNESS, true);
            }
        }

        if (this.landingPoint) {
            const markerSize = 0.3;
            const lp = this.landingPoint;

            // crosshair type shit
            RenderUtils.drawLine(new Vec3d(lp.x - markerSize, lp.y, lp.z), new Vec3d(lp.x + markerSize, lp.y, lp.z), LANDING_COLOR, 4, true);
            RenderUtils.drawLine(new Vec3d(lp.x, lp.y, lp.z - markerSize), new Vec3d(lp.x, lp.y, lp.z + markerSize), LANDING_COLOR, 4, true);

            // box
            const groundVec = new Vec3d(Math.floor(lp.x), Math.floor(Player.getY()), Math.floor(lp.z));
            RenderUtils.drawWireFrame(groundVec, LANDING_COLOR, 2, true);
        }
    }

    handleBounceState() {
        if (this.bounceCount > 40) {
            this.setState(States.RETURN);
            this.bounceCount = 0;
            this.trackedBall = null;
            return;
        }

        if (this.trackedBall && !this.trackedBall.isDead()) {
            this.tickCounter = 0;

            const dx = this.trackedBall.getX() + (this.trackedBall.getX() - this.trackedBall.getLastX()) * 3;
            const dz = this.trackedBall.getZ() + (this.trackedBall.getZ() - this.trackedBall.getLastZ()) * 3;
            const ballY = this.trackedBall.getY();

            const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
            const distance = MathUtils.calculateDistance(playerPos, [dx, ballY, dz]);

            Keybind.setKey('shift', true);

            if (distance.distanceFlat > 0.5) {
                Keybind.setKeysForStraightLineCoords(dx, ballY, dz);
            }
            if (distance.distanceFlat < 0.2) {
                Keybind.stopMovement();
            }
        } else {
            this.tickCounter++;
            if (this.tickCounter > 10) {
                this.setState(States.RETURN);
                this.trackedBall = null;
            }
        }
    }

    handleReturnState() {
        Keybind.unpressKeys();
        this.trackedBall = null;

        const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
        const distanceToStart = MathUtils.calculateDistance(playerPos, this.startPos);

        if (distanceToStart.distance < 2) {
            Keybind.rightClick();
            this.setState(States.PLACE);
            return;
        }

        Rotations.rotateToVector([this.startPos[0], this.startPos[1] + 2, this.startPos[2]], 0.5, false);
        Keybind.setKeysForStraightLineCoords(this.startPos[0], this.startPos[1], this.startPos[2]);
    }

    handlePlaceState() {
        if (!this.trackedBall || this.trackedBall.isDead()) {
            this.trackedBall = this.findBeachBall();

            if (this.trackedBall) {
                this.setState(States.BOUNCE);
                return;
            }
        }

        const ballSlot = Guis.findItemInHotbar('Bouncy Beach Ball');
        if (ballSlot === -1) {
            Chat.message('&cNo bouncy balls in hotbar!');
            this.toggle(false);
            return;
        }

        Player.setHeldItemIndex(ballSlot);

        this.tickCounter++;
        if (this.tickCounter % 10 === 0) {
            Keybind.rightClick();
        }
    }

    findBeachBall() {
        const stands = World.getAllEntitiesOfType(ArmorStandEntity.class);

        for (let element of stands) {
            const headItem = element.getStackInSlot(5);
            if (!headItem) continue;

            if (this.isBeachBall(headItem)) return element;
        }
        return null;
    }

    isBeachBall(item) {
        try {
            const mcItem = item.toMC();
            const profileType = net.minecraft.component.DataComponentTypes.PROFILE;

            const profileComponent = mcItem.get(profileType);
            const data = profileComponent.getGameProfile().toString();

            return data.includes(SMALL_BEACHBALL_BASE64);
        } catch (e) {
            return false;
        }
    }

    setState(newState) {
        this.state = newState;
        this.tickCounter = 0;

        if (newState === States.WAITING || newState === States.RETURN) {
            this.trackedBall = null;
            this.trailHistory = [];
            this.predictedPath = [];
            this.landingPoint = null;
            this.ballDescending = false;
        }

        const stateNames = ['WAITING', 'BOUNCE', 'RETURN', 'PLACE'];
        Chat.message(`&eState: &b${stateNames[newState]}`);
    }

    onEnable() {
        this.setState(States.PLACE);
        this.startPos = [Player.getX(), Player.getY(), Player.getZ()];
        this.trackedBall = null;
        this.trailHistory = [];
        this.predictedPath = [];
        this.landingPoint = null;
        this.ballDescending = false;
        this.lastVelocityY = 0;
        Chat.message('&aBeachBaller enabled');
    }

    onDisable() {
        Keybind.unpressKeys();
        this.trackedBall = null;
        this.state = States.WAITING;
        this.trailHistory = [];
        this.predictedPath = [];
        this.landingPoint = null;
        this.ballDescending = false;
        Chat.message('&cBeachBaller disabled');
    }
}

new Beachballer();
