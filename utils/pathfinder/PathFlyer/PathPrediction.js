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

export function predictStoppingPosition(ticks = 30) {
    const player = Player.getPlayer();
    if (!player) return { x: 0, y: 0, z: 0 };

    let px = Player.getX();
    let py = Player.getY();
    let pz = Player.getZ();

    let { x: vx, y: vy, z: vz } = getCurrentMotion();

    const isFlying = !!player.getAbilities()?.flying;
    const horizontalDrag = 0.91;
    const flyingVerticalDrag = 0.6;
    const fallingVerticalDrag = 0.98;
    const gravity = -0.08;
    const epsilon = 0.01;

    for (let i = 0; i < ticks; i++) {
        px += vx;
        py += vy;
        pz += vz;

        if (isFlying) {
            vx *= horizontalDrag;
            vz *= horizontalDrag;
            vy *= flyingVerticalDrag;
        } else {
            vy += gravity;
            vx *= horizontalDrag;
            vz *= horizontalDrag;
            vy *= fallingVerticalDrag;
        }

        if (Math.abs(vx) < epsilon && Math.abs(vz) < epsilon && Math.abs(vy) < epsilon) break;
    }

    return { x: px, y: py, z: pz };
}
