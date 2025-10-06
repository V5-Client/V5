import { cameraUpdateMixin, changeLookDirectionMixin } from '../../mixins.js';

const USE_TOGGLE_MODE = false;
const PERSPECTIVE_MODE = 2; // 0 = first person, 1 = third person back, 2 = third person front

let isFreeLooking = false;
let cameraPitch = 0;
let cameraYaw = 0;
let firstTime = true;
let lastPerspective = null;

const freeLookKey = new KeyBind(
    'Activate FreeLook',
    Keyboard.KEY_LCONTROL,
    'FreeLook'
);

function startFreeLooking() {
    const minecraft = Client.getMinecraft();
    const options = minecraft.field_1690;

    lastPerspective = options.method_31044();

    const Perspective = Java.type('net.minecraft.client.option.Perspective');
    if (lastPerspective === Perspective.field_26664) {
        // FIRST_PERSON
        const perspectives = [
            Perspective.field_26664, // FIRST_PERSON
            Perspective.field_26665, // THIRD_PERSON_BACK
            Perspective.field_26666, // THIRD_PERSON_FRONT
        ];
        options.method_31043(perspectives[PERSPECTIVE_MODE]);
    }

    isFreeLooking = true;
}

function stopFreeLooking() {
    if (!lastPerspective) return;

    const minecraft = Client.getMinecraft();
    const options = minecraft.field_1690;

    isFreeLooking = false;
    options.method_31043(lastPerspective);
}

register('tick', () => {
    if (!USE_TOGGLE_MODE) {
        if (freeLookKey.isKeyDown() && !isFreeLooking) {
            startFreeLooking();
        } else if (!freeLookKey.isKeyDown() && isFreeLooking) {
            stopFreeLooking();
        }
    } else {
        if (freeLookKey.isPressed()) {
            if (!isFreeLooking) {
                startFreeLooking();
            } else {
                stopFreeLooking();
            }
        }
    }
});

function attachMixin(mixin, name, callback) {
    try {
        mixin.attach(callback);
    } catch (e) {
        ChatLib.chat(`&cFailed to attach ${name}: ${e}`);
    }
}

attachMixin(
    cameraUpdateMixin,
    'cameraUpdate',
    (camera, area, entity, thirdPerson, inverseView, tickDelta, ci) => {
        const PlayerEntity = net.minecraft.entity.player.PlayerEntity;

        if (isFreeLooking && entity instanceof PlayerEntity) {
            const minecraft = Client.getMinecraft();
            const player = minecraft.field_1724;

            if (firstTime && player != null) {
                cameraPitch = player.getPitch();
                cameraYaw = player.getYaw();
                firstTime = false;
            }

            camera.method_19325(cameraYaw, cameraPitch);
        }

        if (!isFreeLooking && entity instanceof PlayerEntity) {
            firstTime = true;
        }
    }
);

attachMixin(
    changeLookDirectionMixin,
    'changeLookDirection',
    (instance, cir) => {
        const PlayerEntity = net.minecraft.entity.player.PlayerEntity;
        const MathHelper = net.minecraft.util.math.MathHelper;

        if (isFreeLooking && instance instanceof PlayerEntity) {
            const args = cir.getArgs ? cir.getArgs() : [];
            const cursorDeltaX = args[0] || 0;
            const cursorDeltaY = args[1] || 0;

            const pitchDelta = cursorDeltaY * 0.15;
            const yawDelta = cursorDeltaX * 0.15;

            cameraPitch = MathHelper.method_15363(
                cameraPitch + pitchDelta,
                -90.0,
                90.0
            );
            cameraYaw += yawDelta;

            cir.cancel();
        }
    }
);
