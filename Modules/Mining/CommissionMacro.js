import { Chat } from '../../Utility/Chat';
const { addToggle, addCategoryItem } = global.Categories;

class CommissionMacro {
    constructor() {
        this.enabled = false;
        this.commissions = [];
        this.lastCommissionCheck = 0;
        this.hasWarned = false;
        this.commissionNames = [
            'Royal Mines Titanium',
            'Royal Mines Mithril',
            'Goblin Slayer',
            'Glacite Walker Slayer',
            'Lava Springs Mithril',
            'Lava Springs Titanium',
            "Rampart's Quarry Titanium",
            "Rampart's Quarry Mithril",
            'Titanium Miner',
            'Mithril Miner',
            'Upper Mines Titanium',
            'Upper Mines Mithril',
            'Cliffside Veins Mithril',
            'Cliffside Veins Titanium',
            'Treasure Hoarder Puncher',
        ];

        this.mainLoop = register('step', () => {
            if (Date.now() - this.lastCommissionCheck > 5000) {
                // 5 seconds
                this.readCommissions();
                this.lastCommissionCheck = Date.now();
            }
        }).unregister();

        this.toggle = (value) => {
            this.enabled = value;
            if (value) this.mainLoop.register();
            else this.mainLoop.unregister();
        };

        this.toggle(this.enabled);

        addCategoryItem(
            'Mining',
            'Commission Macro',
            'Completes Commissions for you',
            'Completes Commissions for you (Dwarven)'
        );

        addToggle(
            'Modules',
            'Commission Macro',
            'Enabled',
            (value) => {
                this.toggle(value);
            },
            'Toggles the Commission Macro module'
        );
    }

    readCommissions() {
        try {
            const tabItems = TabList.getNames();
            let startIndex = -1;

            // Find "Commissions:" in the tab list
            for (let i = 0; i < tabItems.length; i++) {
                const item = tabItems[i];
                if (!item) continue;

                const cleaned = ChatLib.removeFormatting(item).trim();
                console.log(`Index ${i}: "${cleaned}"`);

                if (cleaned === 'Commissions:') {
                    console.log(`Found Commissions at index ${i}`);
                    startIndex = i;
                    break;
                }
            }

            if (startIndex === -1) {
                if (this.commissions.length > 0) this.commissions = [];
                if (!this.hasWarned) {
                    Chat.message(
                        '&cCould not find "Commissions:" in tab list. Make sure you are in the Dwarven Mines.'
                    );
                    this.hasWarned = true;
                }
                return;
            }
            this.hasWarned = false;

            let endIndex = tabItems.length;
            for (let i = startIndex + 1; i < tabItems.length; i++) {
                const item = tabItems[i];
                if (!item) {
                    endIndex = i;
                    break;
                }

                const cleaned = ChatLib.removeFormatting(item).trim();
                if (cleaned === '' || cleaned === 'Powders:') {
                    endIndex = i;
                    break;
                }
            }

            const commissions = [];
            for (let i = startIndex + 1; i < endIndex; i++) {
                const commissionText = tabItems[i];
                if (!commissionText) continue;

                const formattedText =
                    ChatLib.removeFormatting(commissionText).trim();
                if (!formattedText || formattedText === '') continue;

                if (formattedText.includes(':')) {
                    const parts = formattedText.split(':');
                    const name = parts[0].trim();
                    const progressStr = parts[1].trim();

                    if (
                        progressStr.includes('%') ||
                        progressStr.includes('DONE')
                    ) {
                        let progress;
                        if (progressStr.includes('DONE')) {
                            progress = 1;
                        } else {
                            progress =
                                parseFloat(
                                    progressStr
                                        .replace(/ /g, '')
                                        .replace('%', '')
                                ) / 100;
                        }

                        commissions.push({ name, progress });
                    }
                }
            }

            if (
                JSON.stringify(this.commissions) !== JSON.stringify(commissions)
            ) {
                this.commissions = commissions;
                if (this.commissions.length > 0) {
                    Chat.message('&a--- Commissions ---');
                    this.commissions.forEach((c) => {
                        Chat.message(
                            `&7- &f${c.name}: &b${
                                c.progress === 1
                                    ? 'DONE'
                                    : (c.progress * 100).toFixed(2) + '%'
                            }`
                        );
                    });
                } else {
                    Chat.message('&aNo active commissions found.');
                }
            }
        } catch (e) {
            Chat.message('Error reading commissions: ' + e);
            console.log('Error reading commissions: ' + e);
            this.commissions = [];
        }
    }
}

new CommissionMacro();
