export function getCurrentMotion() {
    if (!Player.getPlayer()) {
        return { x: 0, y: 0, z: 0 };
    }

    return {
        x: Player.getMotionX(),
        y: Player.getMotionY(),
        z: Player.getMotionZ(),
    };
}

export function predictXZ(ticks = 8) {
    const player = Player.getPlayer();
    if (!player) return { x: 0, y: 0, z: 0 };

    let px = Player.getX();
    let py = Player.getY();
    let pz = Player.getZ();

    let { x: vx, y: vy, z: vz } = getCurrentMotion();

    const horizontalDrag = 0.91;
    const verticalDrag = 0.98;
    const gravity = -0.08;
    const epsilon = 0.002;
    const simTicks = Math.max(1, Math.floor(Number(ticks) || 0));

    for (let i = 0; i < simTicks; i++) {
        px += vx;
        py += vy;
        pz += vz;

        vy += gravity;
        vx *= horizontalDrag;
        vz *= horizontalDrag;
        vy *= verticalDrag;

        if (Math.abs(vx) < epsilon && Math.abs(vz) < epsilon && Math.abs(vy) < epsilon) break;
    }

    return { x: px, y: py, z: pz };
}
