import { Vec3d } from '../../utils/Constants';
import { v5Command } from '../../utils/V5Commands';

const AABB = net.minecraft.world.phys.AABB;
const COUNT = 5000;
const PHASE_DURATION = 15_000;
const COLOR_2D = Render2D.getColor(80, 180, 255, 120);
const COLOR_2D_ALT = Render2D.getColor(255, 120, 80, 120);
const COLOR = new RenderColor(80, 180, 255, 120);
const COLOR_ALT = new RenderColor(255, 120, 80, 120);
const IMAGE = Image.fromAsset('icon.png');
const TWO_D_PHASES = [
    'Rect',
    'Rounded Rect',
    'Varied Rounded Rect',
    'Circle',
    'Hollow Rect',
    'Line',
    'Drop Shadow',
    'Gradient',
    'Hollow Gradient',
    'Checkerboard',
    'Hue Bar',
    'Text',
    'String',
    'Image',
    'Player',
].map((type) => ({ renderer: '2D', type }));
const THREE_D_PHASES = ['Filled Box', 'Wireframe Box', 'Box', 'Styled Box', 'Sized Filled Box', 'Sized Wireframe Box', 'Line', 'Tracer', 'Text', 'Hitbox'].map(
    (type) => ({ renderer: '3D', type })
);

let phases = [];
let phaseIndex = 0;
let phaseStartedAt = 0;
let frames = 0;
let positions = [];
let boxes = [];

const currentPhase = () => phases[phaseIndex];

const stop = () => {
    phases = [];
    ChatLib.chat('&cRenderer benchmark stopped.');
};

const setPositions = () => {
    if (!World.isLoaded() || !Player.getPlayer()) {
        ChatLib.chat('&cJoin a world before starting the 3D renderer benchmark.');
        return false;
    }

    const x = Player.getX();
    const y = Player.getY();
    const z = Player.getZ();
    const yaw = (Number(Client.getCameraYaw() ?? Player.getYaw()) * Math.PI) / 180;
    const pitch = (Number(Client.getCameraPitch() ?? Player.getPitch()) * Math.PI) / 180;
    const forwardX = -Math.sin(yaw) * Math.cos(pitch);
    const forwardY = -Math.sin(pitch);
    const forwardZ = Math.cos(yaw) * Math.cos(pitch);
    const sideX = Math.cos(yaw);
    const sideZ = Math.sin(yaw);
    const upX = -Math.sin(yaw) * Math.sin(pitch);
    const upY = Math.cos(pitch);
    const upZ = Math.cos(yaw) * Math.sin(pitch);
    positions = [];
    boxes = [];
    for (let index = 0; index < COUNT; index++) {
        const cell = index % 500;
        const side = ((cell % 25) - 12) * 0.35;
        const height = (Math.floor(cell / 25) - 10) * 0.35;
        const distance = 5 + Math.floor(index / 500) * 0.01;
        const position = new Vec3d(
            x + forwardX * distance + sideX * side + upX * height,
            y + 1.6 + forwardY * distance + upY * height,
            z + forwardZ * distance + sideZ * side + upZ * height
        );
        positions.push(position);
        boxes.push(new AABB(position.x, position.y, position.z, position.x + 1, position.y + 1, position.z + 1));
    }
    return true;
};

const start = (mode) => {
    if (mode !== '2d' && !setPositions()) return;

    phases =
        mode === '2d'
            ? TWO_D_PHASES.filter((phase) => phase.type !== 'Player' || (World.isLoaded() && Player.getPlayer()))
            : mode === '3d'
              ? THREE_D_PHASES
              : [...TWO_D_PHASES, ...THREE_D_PHASES];
    phaseIndex = 0;
    frames = 0;
    phaseStartedAt = Date.now();
    ChatLib.chat(`&aRenderer benchmark started: &f${phases.length} phases, ${COUNT} draws/frame, 15s each.`);
};

const finishFrame = (phase) => {
    frames++;
    const elapsed = Date.now() - phaseStartedAt;
    if (elapsed < PHASE_DURATION) return;

    ChatLib.chat(`&b${phase.renderer} ${phase.type}&7: &f${((frames * 1000) / elapsed).toFixed(1)} FPS`);
    phaseIndex++;
    frames = 0;
    phaseStartedAt = Date.now();
    if (!currentPhase()) ChatLib.chat('&aRenderer benchmark complete.');
};

Render2D.registerV5Render(() => {
    const phase = currentPhase();
    if (!phase || phase.renderer !== '2D' || ['String', 'Image', 'Player'].includes(phase.type)) return;

    const width = Render2D.screen.getWidth();
    const height = Render2D.screen.getHeight();
    Render2D.save();
    Render2D.globalAlpha(0.8);
    Render2D.scissor(0, 0, width, height);
    for (let index = 0; index < COUNT; index++) {
        const x = (index * 17) % width;
        const y = (index * 29) % height;
        switch (phase.type) {
            case 'Rect':
                Render2D.drawRect(x, y, 12, 12, COLOR_2D);
                break;
            case 'Rounded Rect':
                Render2D.drawRoundedRect(x, y, 12, 12, 3, COLOR_2D);
                break;
            case 'Varied Rounded Rect':
                Render2D.drawRoundedRectVaried(x, y, 12, 12, COLOR_2D, 2, 4, 6, 8);
                break;
            case 'Circle':
                Render2D.drawCircle(x + 6, y + 6, 6, COLOR_2D);
                break;
            case 'Hollow Rect':
                Render2D.drawHollowRect(x, y, 12, 12, 2, COLOR_2D);
                break;
            case 'Line':
                Render2D.drawLine(x, y, x + 12, y + 12, 2, COLOR_2D);
                break;
            case 'Drop Shadow':
                Render2D.drawDropShadow(x, y, 12, 12, 3, 4, 1, COLOR_2D);
                break;
            case 'Gradient':
                Render2D.drawGradientRect(x, y, 12, 12, COLOR_2D, COLOR_2D_ALT, 'TopToBottom');
                break;
            case 'Hollow Gradient':
                Render2D.drawHollowGradientRect(x, y, 12, 12, 2, COLOR_2D, COLOR_2D_ALT, 'TopToBottom');
                break;
            case 'Checkerboard':
                Render2D.drawCheckerboard(x, y, 12, 12, 2);
                break;
            case 'Hue Bar':
                Render2D.drawHueBar(x, y, 12, 12, 2);
                break;
            case 'Text':
                Render2D.text('V5', x, y, 8, COLOR_2D, Render2D.getDefaultFont(), 0);
                break;
            default:
                return;
        }
    }
    Render2D.resetScissor();
    Render2D.restore();
    finishFrame(phase);
});

register('renderOverlay', () => {
    const phase = currentPhase();
    if (!phase || phase.renderer !== '2D' || !['String', 'Image', 'Player'].includes(phase.type)) return;

    const width = Render2D.screen.getWidth();
    const height = Render2D.screen.getHeight();
    for (let index = 0; index < COUNT; index++) {
        const x = (index * 17) % width;
        const y = (index * 29) % height;
        if (phase.type === 'String') Render2D.drawString('V5', x, y, COLOR_2D, true);
        else if (phase.type === 'Image') Render2D.drawImage(IMAGE, x, y, 12, 12);
        else Render2D.drawPlayer({ x, y, size: 12 });
    }
    finishFrame(phase);
});

register('postRenderWorld', () => {
    const phase = currentPhase();
    if (!phase || phase.renderer !== '3D' || !World.isLoaded()) return;
    if ((!positions.length || !boxes.length) && !setPositions()) return;

    const player = Player.getPlayer();
    if (!player) return;

    positions.forEach((position, index) => {
        switch (phase.type) {
            case 'Filled Box':
                Render3D.drawFilledBox(position, COLOR, false);
                break;
            case 'Wireframe Box':
                Render3D.drawWireFrameBox(position, COLOR, 1, false);
                break;
            case 'Box':
                Render3D.drawBox(boxes[index], COLOR, 1, false);
                break;
            case 'Styled Box':
                Render3D.drawStyledBox(position, COLOR, COLOR_ALT, 1, false);
                break;
            case 'Sized Filled Box':
                Render3D.drawSizedBox(position, 0.25, 0.25, 0.25, COLOR, true, 1, false);
                break;
            case 'Sized Wireframe Box':
                Render3D.drawSizedBox(position, 0.25, 0.25, 0.25, COLOR, false, 1, false);
                break;
            case 'Line':
                Render3D.drawLine(position, position.add(0, 0.5, 0), COLOR, 1, false);
                break;
            case 'Tracer':
                Render3D.drawTracer(position, COLOR, 1, false);
                break;
            case 'Text':
                Render3D.drawText('V5', position.add(0, 0.5, 0), 0.5, false, false, false);
                break;
            default:
                Render3D.drawHitbox(player, COLOR, 1, false);
        }
    });
    finishFrame(phase);
});

v5Command('benchmark', () => start('all'));
v5Command('benchmark 2d', () => start('2d'));
v5Command('benchmark 3d', () => start('3d'));
v5Command('benchmark stop', stop);
