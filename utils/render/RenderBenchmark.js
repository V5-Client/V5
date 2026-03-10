//@Private
import Render from './Render';
import { Vec3d, System } from '../Constants';

const MODES = ['mixed', 'box', 'wire', 'styled', 'line', 'text'];

const bench = {
    active: false,
    mode: 'mixed',
    boxes: 2000,
    seconds: 10,
    radius: 32,
    positions: [],
    lineEnds: [],
    colors: {
        fill: Render.Color(30, 170, 255, 90),
        wire: Render.Color(255, 230, 90, 255),
        altFill: Render.Color(255, 90, 90, 80),
        altWire: Render.Color(90, 255, 110, 255),
        line: Render.Color(255, 255, 255, 255),
        text: Render.Color(255, 255, 255, 255),
    },
    startedAtNs: 0,
    endAtNs: 0,
    lastFrameNs: 0,
    samples: 0,
    frameNsSum: 0,
    frameNsMin: Number.MAX_VALUE,
    frameNsMax: 0,
    workNsSum: 0,
    workNsMin: Number.MAX_VALUE,
    workNsMax: 0,
    frameSamplesNs: [],
    drawCalls: 0,
    framesWithRender: 0,
};

const toFixed = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '0.000');
const nsToMs = (ns) => ns / 1_000_000;

function resetStats() {
    bench.samples = 0;
    bench.frameNsSum = 0;
    bench.frameNsMin = Number.MAX_VALUE;
    bench.frameNsMax = 0;
    bench.workNsSum = 0;
    bench.workNsMin = Number.MAX_VALUE;
    bench.workNsMax = 0;
    bench.frameSamplesNs = [];
    bench.drawCalls = 0;
    bench.framesWithRender = 0;
}

function stopBenchmark(reason = 'completed') {
    if (!bench.active) return;
    bench.active = false;

    const totalFrames = Math.max(bench.samples, 1);
    const renderedFrames = Math.max(bench.framesWithRender, 1);

    const avgFrameNs = bench.frameNsSum / totalFrames;
    const avgFrameMs = nsToMs(avgFrameNs);
    const minFrameNs = bench.frameNsMin === Number.MAX_VALUE ? 0 : bench.frameNsMin;
    const maxFrameNs = bench.frameNsMax;

    const avgFps = avgFrameNs > 0 ? 1_000_000_000 / avgFrameNs : 0;
    const minFps = maxFrameNs > 0 ? 1_000_000_000 / maxFrameNs : 0;
    const maxFps = minFrameNs > 0 ? 1_000_000_000 / minFrameNs : 0;

    const sortedSlowFrames = bench.frameSamplesNs.slice().sort((a, b) => b - a);
    const onePercentCount = Math.max(1, Math.ceil(sortedSlowFrames.length * 0.01));
    let onePercentNsSum = 0;
    for (let i = 0; i < onePercentCount; i++) {
        onePercentNsSum += sortedSlowFrames[i];
    }
    const onePercentLowFps = onePercentNsSum > 0 ? 1_000_000_000 / (onePercentNsSum / onePercentCount) : 0;

    const summary = [
        '[RenderBenchmark] done',
        `reason=${reason}`,
        `mode=${bench.mode}`,
        `boxes=${bench.boxes}`,
        `seconds=${bench.seconds}`,
        `frames=${bench.samples}`,
        `avgFrameMs=${toFixed(avgFrameMs)}`,
        `avgFPS=${toFixed(avgFps, 2)}`,
        `minFPS=${toFixed(minFps, 2)}`,
        `maxFPS=${toFixed(maxFps, 2)}`,
        `1%LowFPS=${toFixed(onePercentLowFps, 2)}`,
    ].join(' | ');

    console.log(summary);
    ChatLib.chat(`&b[RenderBenchmark]&r Finished. Check console for detailed numbers.`);
}

function buildPositions() {
    bench.positions = [];
    bench.lineEnds = [];

    const base = Player.getPlayer();
    if (!base) return;

    const baseX = Math.floor(Player.getX());
    const baseY = Math.floor(Player.getY()) + 1;
    const baseZ = Math.floor(Player.getZ());

    const side = Math.ceil(Math.cbrt(bench.boxes));
    const half = Math.floor(side / 2);

    let generated = 0;

    for (let y = 0; y < side && generated < bench.boxes; y++) {
        for (let x = 0; x < side && generated < bench.boxes; x++) {
            for (let z = 0; z < side && generated < bench.boxes; z++) {
                const px = baseX + x - half;
                const py = baseY + y;
                const pz = baseZ + z - half;

                bench.positions.push(new Vec3d(px, py, pz));
                bench.lineEnds.push(new Vec3d(px + 0.85, py + 0.85, pz + 0.85));

                generated++;
            }
        }
    }
}

function startBenchmark(boxes, seconds, mode) {
    if (bench.active) {
        ChatLib.chat('&c[RenderBenchmark] Already running. Use /v5renderbench stop first.');
        return;
    }

    bench.boxes = Math.max(1, Math.min(8000, boxes));
    bench.seconds = Math.max(1, Math.min(120, seconds));
    bench.mode = MODES.includes(mode) ? mode : 'mixed';

    buildPositions();
    if (bench.positions.length === 0) {
        ChatLib.chat('&c[RenderBenchmark] Could not create benchmark positions.');
        return;
    }

    resetStats();

    const now = System.nanoTime();
    bench.active = true;
    bench.startedAtNs = now;
    bench.endAtNs = now + bench.seconds * 1_000_000_000;
    bench.lastFrameNs = 0;

    ChatLib.chat(`&a[RenderBenchmark] Running mode=${bench.mode} boxes=${bench.boxes} seconds=${bench.seconds}`);
    console.log(`[RenderBenchmark] start | mode=${bench.mode} | boxes=${bench.boxes} | seconds=${bench.seconds}`);
}

function renderPass() {
    const now = System.nanoTime();

    if (bench.lastFrameNs !== 0) {
        const frameDelta = now - bench.lastFrameNs;
        bench.frameNsSum += frameDelta;
        bench.frameNsMin = Math.min(bench.frameNsMin, frameDelta);
        bench.frameNsMax = Math.max(bench.frameNsMax, frameDelta);
        bench.frameSamplesNs.push(frameDelta);
        bench.samples++;
    }
    bench.lastFrameNs = now;

    if (now >= bench.endAtNs) {
        stopBenchmark('timeout');
        return;
    }

    const workStart = now;
    let calls = 0;

    const fillColor = bench.colors.fill;
    const wireColor = bench.colors.wire;
    const altFill = bench.colors.altFill;
    const altWire = bench.colors.altWire;
    const lineColor = bench.colors.line;

    const count = bench.positions.length;

    if (bench.mode === 'box') {
        for (let i = 0; i < count; i++) {
            Render.drawBox(bench.positions[i], fillColor, false);
        }
        calls += count;
    } else if (bench.mode === 'wire') {
        for (let i = 0; i < count; i++) {
            Render.drawWireFrame(bench.positions[i], wireColor, 3, false);
        }
        calls += count;
    } else if (bench.mode === 'styled') {
        for (let i = 0; i < count; i++) {
            Render.drawStyledBox(bench.positions[i], fillColor, wireColor, 3, false);
        }
        calls += count;
    } else if (bench.mode === 'line') {
        for (let i = 0; i < count; i++) {
            Render.drawLine(bench.positions[i], bench.lineEnds[i], lineColor, 3, false);
        }
        calls += count;
    } else if (bench.mode === 'text') {
        const tCount = Math.min(count, 1500);
        for (let i = 0; i < tCount; i++) {
            Render.drawText('bench', bench.positions[i], 0.9, false, false, true, true);
        }
        calls += tCount;
    } else {
        for (let i = 0; i < count; i++) {
            const p = bench.positions[i];
            if ((i & 1) === 0) {
                Render.drawStyledBox(p, fillColor, wireColor, 3, false);
                calls += 1;
            } else {
                Render.drawBox(p, altFill, false);
                Render.drawWireFrame(p, altWire, 2, false);
                calls += 2;
            }

            if ((i & 3) === 0) {
                Render.drawLine(p, bench.lineEnds[i], lineColor, 2, false);
                calls++;
            }
        }
    }

    const workNs = System.nanoTime() - workStart;
    bench.workNsSum += workNs;
    bench.workNsMin = Math.min(bench.workNsMin, workNs);
    bench.workNsMax = Math.max(bench.workNsMax, workNs);
    bench.drawCalls += calls;
    bench.framesWithRender++;
}

register('postRenderWorld', () => {
    if (!bench.active) return;
    renderPass();
});

register('worldUnload', () => {
    if (bench.active) stopBenchmark('world-unload');
});

register('command', (...args) => {
    if (!args || args.length === 0) {
        ChatLib.chat('&b[RenderBenchmark]&r /v5renderbench start [boxes] [seconds] [mode]');
        ChatLib.chat('&b[RenderBenchmark]&r /v5renderbench stop');
        ChatLib.chat(`&b[RenderBenchmark]&r modes: ${MODES.join(', ')}`);
        return;
    }

    const sub = String(args[0]).toLowerCase();

    if (sub === 'stop') {
        stopBenchmark('manual-stop');
        return;
    }

    if (sub !== 'start') {
        ChatLib.chat('&c[RenderBenchmark] Unknown subcommand. Use start/stop.');
        return;
    }

    const boxes = args[1] != null ? parseInt(args[1], 10) : 2000;
    const seconds = args[2] != null ? parseInt(args[2], 10) : 10;
    const mode = args[3] != null ? String(args[3]).toLowerCase() : 'mixed';

    startBenchmark(Number.isFinite(boxes) ? boxes : 2000, Number.isFinite(seconds) ? seconds : 10, mode);
}).setName('v5renderbench');
