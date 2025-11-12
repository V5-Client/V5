import { ModuleBase } from '../../Utility/ModuleBase';
import { Chat } from '../../Utility/Chat';
import { Keybind } from '../../Utility/Keybinding';
import { MathUtils } from '../../Utility/Math';
import { Guis } from '../../Utility/Inventory';
import { Rotations } from '../../Utility/Rotations';

const SMALL_BEACHBALL_BASE64 =
    'ewogICJ0aW1lc3RhbXAiIDogMTczNjQyNzQ4ODAwNCwKICAicHJvZmlsZUlkIiA6ICIzN2JhNjRkYzkxOTg0OGI4YjZhNDdiYTg0ZDgwNDM3MCIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb3lLb3NhIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzJhZGY5ZDcxMzY3Y2Q2ZTUwNWZiNDhjYWFhNWFjZGNkZmYyYTA5ZjY2YzQ4OGRhZjA0ZDA0NWVlMGJmNTI4ZTEiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==';

const LARGE_BEACHBALL_BASE64 = 'I CANT FUCKING FIND IT CUZ IM STUPID :(';

const States = {
    WAITING: 0,
    BOUNCE: 1,
    RETURN: 2,
    PLACE: 3,
};

class Beachballer extends ModuleBase {
    constructor() {
        super({
            name: 'Beachballer',
            subcategory: 'Other',
            description: 'Automatically bounces beach balls',
            tooltip: 'Bounces beach balls and returns to start position at 40 bounces',
        });

        this.bounceCount = 0;
        this.tickCounter = 0;
        this.bounceTimer = 0;
        this.startPos = [0, 0, 0];
        this.state = States.WAITING;
        this.trackedBall = null;

        this.sneakKey = Client.getMinecraft().options.sneakKey;

        this.bindToggleKey();

        this.on('tick', () => {
            if (Client.isInGui() && !Client.isInChat()) {
                this.toggle(false);
                return;
            }

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

        this.on('command', () => {
            this.toggle();
        }).setName('beachball');
    }

    handleBounceState() {
        if (this.bounceCount > 40) {
            this.setState(States.RETURN);
            this.bounceCount = 0;
            this.trackedBall = null;
            return;
        }

        Rotations.rotateToAngles(Player.getYaw(), -90, 1.0, false);

        if (this.trackedBall && !this.trackedBall.isDead()) {
            const headItem = this.trackedBall.getStackInSlot(5);

            if (headItem) {
                this.tickCounter = 0;

                // Predict ball position
                const dx = this.trackedBall.getX() + (this.trackedBall.getX() - this.trackedBall.getLastX()) * 3;
                const dz = this.trackedBall.getZ() + (this.trackedBall.getZ() - this.trackedBall.getLastZ()) * 3;
                const ballY = this.trackedBall.getY();

                const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
                const distance = MathUtils.calculateDistance(playerPos, [dx, ballY, dz]);

                if (distance.distance > 15) {
                    this.trackedBall = null;
                    return;
                }

                this.sneakKey.setPressed(true);

                if (distance.distanceFlat > 0.5) {
                    Keybind.setKeysForStraightLineCoords(dx, ballY, dz);
                } else if (distance.distanceFlat < 0.2) {
                    Keybind.stopMovement();
                }
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
        const stands = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity.class);

        for (const element of stands) {
            const headItem = element.getStackInSlot(5);
            if (!headItem) continue;

            if (this.isBeachBall(headItem)) {
                return element;
            }
        }

        return null;
    }

    isBeachBall(item) {
        try {
            const nbtString = item.getNBT().toString();

            return nbtString.includes(SMALL_BEACHBALL_BASE64) || nbtString.includes(LARGE_BEACHBALL_BASE64);
        } catch (e) {
            return false;
        }
    }

    setState(newState) {
        this.state = newState;
        this.tickCounter = 0;

        if (newState === States.WAITING || newState === States.RETURN) {
            this.trackedBall = null;
        }

        const stateNames = ['WAITING', 'BOUNCE', 'RETURN', 'PLACE'];
        Chat.message(`&eState: &b${stateNames[newState]}`);
    }

    onEnable() {
        this.setState(States.PLACE);
        this.startPos = [Player.getX(), Player.getY(), Player.getZ()];
        this.trackedBall = null;
        Chat.message('&aBeachBaller enabled');
    }

    onDisable() {
        Keybind.unpressKeys();
        this.trackedBall = null;
        this.state = States.WAITING;
        Chat.message('&cBeachBaller disabled');
    }
}

new Beachballer();
