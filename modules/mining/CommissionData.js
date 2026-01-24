export const EMISSARY_LOCATIONS = [
    [129, 195, 196],
    [42, 134, 22],
    [171, 149, 31],
    [-73, 152, -11],
    [-133, 173, -51],
    [-38, 199, -132],
    [58, 197, -9],
];

export const TRASH_ITEMS = ['Mithril', 'Titanium', 'Rune', 'Glacite', 'Goblin', 'Cobblestone', 'Stone'];

export const MOB_CONFIGS = {
    goblin: {
        names: ['Goblin', 'Weakling', 'Knifethrower', 'Fireslinger'],
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y > 127 && !(z > 153 && x < -157) && !(z < 148 && x > -77),
    },
    icewalker: {
        names: ['Ice Walker', 'Glacite Walker'],
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y >= 127 && y <= 136 && z <= 180 && z >= 134 && x <= 80,
    },
    treasure: {
        names: ['Treasuer Hunter'], // MISSPELLED ON PURPOSE (Hypixel typo)
        checkVisibility: false,
        boundaryCheck: (x, y, z) => y >= 200 && y <= 210,
    },
};

export const COMMISSION_DATA = [
    {
        names: ['Royal Mines Titanium', 'Royal Mines Mithril'],
        type: 'MINING',
        cost: 5,
        waypoints: [
            [141, 151, 24],
            [173, 149, 70],
            [166, 148, 90],
        ],
    },
    {
        names: ['Cliffside Veins Mithril', 'Cliffside Veins Titanium'],
        type: 'MINING',
        cost: 10,
        waypoints: [
            [46, 134, 11],
            [25, 128, 27],
            [10, 127, 37],
        ],
    },
    {
        names: ['Upper Mines Titanium', 'Upper Mines Mithril'],
        type: 'MINING',
        cost: 15,
        waypoints: [
            [-113, 166, -75],
            [-125, 170, -76],
            [-78, 187, -74],
        ],
    },
    {
        names: ["Rampart's Quarry Titanium", "Rampart's Quarry Mithril"],
        type: 'MINING',
        cost: 15,
        waypoints: [
            [-88, 146, 29],
            [-87, 146, -14],
            [-118, 149, -31],
        ],
    },
    {
        names: ['Lava Springs Mithril', 'Lava Springs Titanium'],
        type: 'MINING',
        cost: 20,
        waypoints: [
            [50, 197, -26],
            [42, 197, -20],
        ],
    },
    {
        // GENERIC
        names: ['Titanium Miner', 'Mithril Miner'],
        type: 'MINING',
        cost: 12,
        waypoints: [
            // Cliffside Veins
            [46, 134, 11],
            [25, 128, 27],
            [10, 127, 37],
            // Rampart's Quarry
            [-88, 146, 29],
            [-87, 146, -14],
            [-118, 149, -31],
        ],
    },
    {
        names: ['Goblin Slayer'],
        type: 'SLAYER',
        cost: 30,
        waypoints: [[-130, 145, 147]],
    },
    {
        names: ['Glacite Walker Slayer', 'Mines Slayer'],
        type: 'SLAYER',
        cost: 25,
        waypoints: [[0, 127, 157]],
    },
    {
        names: ['Treasure Hoarder Puncher'],
        type: 'SLAYER',
        cost: 50,
        waypoints: [[-117, 204, -56]],
    },
];
