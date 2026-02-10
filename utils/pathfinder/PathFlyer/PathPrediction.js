// APPROXIMATION. It's not perfect but it's far more than good enough for this.

export function getCurrentMotion() {
    return {
        x: Player.getMotionX(),
        y: Player.getMotionY(),
        z: Player.getMotionZ(),
    };
}

export function predictStoppingPosition(ticks = 30) {
    const player = Player.getPlayer();
    if (!player) return { x: Player.getX(), y: Player.getY(), z: Player.getZ() };

    let px = Player.getX();
    let py = Player.getY();
    let pz = Player.getZ();

    let { x: vx, y: vy, z: vz } = getCurrentMotion();

    const isFlying = !!player.getAbilities()?.flying;

    const dragXZ = 0.91;
    const dragYFlying = 0.6;
    const gravity = -0.08;
    const dragY = 0.98;

    for (let i = 0; i < ticks; i++) {
        px += vx;
        py += vy;
        pz += vz;

        if (isFlying) {
            vx *= dragXZ;
            vz *= dragXZ;
            vy *= dragYFlying;
        } else {
            vy += gravity;
            vx *= dragXZ;
            vz *= dragXZ;
            vy *= dragY;
        }

        if (Math.abs(vx) < 0.01 && Math.abs(vz) < 0.01 && Math.abs(vy) < 0.01) break;
    }

    return { x: px, y: py, z: pz };
}
