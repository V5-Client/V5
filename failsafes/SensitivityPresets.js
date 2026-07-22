const NORMAL = {
    rotation: { totalDegThreshold: 50, smallYawThreshold: 8, smallPitchThreshold: 5, smallFlagThreshold: 4 },
    teleport: { tiers: [1, 2, 3, Infinity] },
    velocity: { tiers: [0.5, 1, 2, Infinity] },
    player: { lookFlags: 60, lookDistance: 10, dynamicScaling: 0.19 },
    block: { range: 5, changeThreshold: 15 },
    smart: { threshold: 0.06 },
};

export const TIER_SEVERITIES = ['low', 'medium', 'high', 'very high'];

export const PRESETS = {
    Relaxed: {
        ...NORMAL,
        rotation: { ...NORMAL.rotation, totalDegThreshold: 63, smallFlagThreshold: 5 },
        teleport: { tiers: [1.5, 3, 5, Infinity] },
        velocity: { tiers: [0.8, 1.5, 3, Infinity] },
        player: { lookFlags: 80, lookDistance: 8, dynamicScaling: 0.25 },
        smart: { threshold: 0.04 },
    },
    Normal: NORMAL,
    High: {
        ...NORMAL,
        rotation: { ...NORMAL.rotation, totalDegThreshold: 41, smallFlagThreshold: 3 },
        teleport: { tiers: [0.75, 1.5, 2.5, Infinity] },
        velocity: { tiers: [0.35, 0.75, 1.5, Infinity] },
        player: { lookFlags: 40, lookDistance: 13, dynamicScaling: 0.13 },
        block: { range: 6, changeThreshold: 13 },
        smart: { threshold: 0.08 },
    },
    Strict: {
        ...NORMAL,
        rotation: { ...NORMAL.rotation, totalDegThreshold: 32, smallFlagThreshold: 2 },
        teleport: { tiers: [0.5, 1, 2, Infinity] },
        velocity: { tiers: [0.25, 0.5, 1, Infinity] },
        player: { lookFlags: 20, lookDistance: 20, dynamicScaling: 0.09 },
        block: { range: 7, changeThreshold: 11 },
        smart: { threshold: 0.1 },
    },
};
