import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';

class AutoBeg extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Beg',
            subcategory: 'Other',
            description: 'Automatically begs for hypixel ranks periodically.',
            tooltip: 'Automatically begs for hypixel ranks periodically.',
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();

        this.rank = 'vip';
        this.intervalSeconds = 30;
        this.lastMessageTime = 0;

        this.addSlider('Message Interval (s)', 5, 300, 30, (seconds) => {
            this.intervalSeconds = seconds;
        });

        this.addMultiToggle('Rank Selector', ['vip', 'vip+', 'mvp', 'mvp+', 'mvp++'], true, (options) => {
            this.rank = options.find((option) => option.enabled)?.name || 'vip';
        });

        this.begging_messages = [
            `anyone got a spare rank pls??`,
            `hey can someone gift me a rank?`,
            `anyone nice enough to rank a noob :(`,
            `looking for a rank so i can unlock cool cosmetics :3`,
            `plz rank me i want to have fun`,
            `if anyone is feeling generous a rank would be epic plss`,
            `looking for a free rank to play with my friends :)`,
            `need a rank to flex on the noobs lol`,
            `anyone got any extra rank lying around they dont mind giving me :)`,
            `i cant afford a rank can i get one`,
            `pls rank me i will be your best friend forever`,
            `hey anyone willing to rank me up i'm new`,
            `pls give me a rank i will be your friend`,
            `can someone give me a rank im poor`,
            `anyone want to gift me a rank i want {rank_placeholder}`,
            `i need a rank so i can make a guild`,
            `can someone rank me i will give stuff`,
            `pls rank me i will do whatever you want`,
            `looking for a rank giveaway`,
            `anyone nice enough to give me {rank_placeholder}`,
            `i need a rank to be cool`,
            `anyone have an extra rank`,
            `i will pay you back for a rank later promise`,
            `can i get a free rank`,
            `if anyone is bored and feeling nice rank me`,
            `i have no rank i need one pls`,
            `hey can i get a rank im new to the game`,
            `pls give me a free rank`,
            `pls give me a rank i will do anything`,
            `anyone got any free ranks`,
            `can i please get a free rank`,
            `pls rank me i will be your friend for life`,
            `plz rank me i am poor`,
            `hey can anyone gift me a rank pls`,
            `looking for {rank_placeholder} gift`,
            `pls give me {rank_placeholder}`,
            `can anyone give me a rank so i can enjoy the game`,
            `looking for a free rank to join my friends game`,
            `need a rank so i can join my friends`,
            `can someone help me get a rank`,
            `pls give me rank`,
            `i want to join my friends game need a rank`,
            `can i have a free rank pls`,
            `pls rank me`,
            `looking for a {rank_placeholder} gift`,
            `pls give me {rank_placeholder} im sad`,
            `anyone got a {rank_placeholder} for me`,
            `i cant afford a rank pls help`,
            `can i have a rank gift pls`,
            `pls help me get a rank`,
            `pls rank me`,
            `looking for {rank_placeholder}`,
            `can i get a rank`,
            `can i have a rank`,
            `pls rank me`,
            `anyone nice to gift me {rank_placeholder}`,
            `pls gift me {rank_placeholder}`,
            `gift me {rank_placeholder}`,
            `need a rank pls`,
            `i need rank`,
            `someone gift me`,
            `rank pls`,
            `can someone give me {rank_placeholder}`,
            `i want {rank_placeholder}`,
            `any {rank_placeholder} giveaway`,
            `need rank to play with friends`,
            `gifting me a rank is ok`,
            `can someone give me rank`,
            `looking for {rank_placeholder} giveaway`,
            `give me rank`,
            `anyone got extra rank`,
            `can i have rank`,
            `anyone give {rank_placeholder}`,
            `gift me rank`,
            `pls can i get rank`,
            `can someone gift me rank`,
            `i need {rank_placeholder}`,
            `give me {rank_placeholder}`,
            `can i get a free rank`,
            `rank pls`,
            `pls i need a rank`,
            `need {rank_placeholder}`,
            `any rank giveaway`,
            `plz can i get rank`,
            `pls gift me a rank`,
            `anyone have a spare {rank_placeholder}?`,
            `looking for someone to upgrade my rank to {rank_placeholder}`,
            `can someone gift me {rank_placeholder}?`,
            `i need {rank_placeholder}, anyone?`,
            `pls rank me up to {rank_placeholder}`,
            `can someone upgrade me to {rank_placeholder}?`,
            `i really want {rank_placeholder}`,
            `can anyone upgrade my rank?`,
            `pls, {rank_placeholder} would be amazing`,
            `anyone wanna gift me {rank_placeholder}?`,
            `is anyone giving away {rank_placeholder}?`,
            `i'll do anything for {rank_placeholder}`,
            `looking for an {rank_placeholder} upgrade`,
            `can i get {rank_placeholder} please?`,
            `i'm trying to get {rank_placeholder}, any help?`,
            `anyone generous enough to give me {rank_placeholder}?`,
            `{rank_placeholder} would be so cool`,
            `can someone upgrade me?`,
            `i'd love {rank_placeholder}`,
            `anyone feeling nice, {rank_placeholder}?`,
            `i need an {rank_placeholder} upgrade`,
            `anyone got a spare {rank_placeholder}?`,
            `i want {rank_placeholder} so bad`,
            `can someone upgrade my rank to {rank_placeholder}?`,
            `looking for {rank_placeholder} or even just {rank_placeholder}`,
            `pls i need {rank_placeholder}`,
            `any {rank_placeholder} gifts?`,
            `can someone upgrade my rank?`,
            `i need {rank_placeholder} to be cool`,
            `any {rank_placeholder} giveaways?`,
            `can i have {rank_placeholder}?`,
            `looking for {rank_placeholder} upgrade`,
            `anyone got an extra {rank_placeholder}?`,
            `i'd love to get {rank_placeholder}`,
            `can i get {rank_placeholder} please?`,
            `i need {rank_placeholder} help`,
            `pls help me get {rank_placeholder}`,
            `i wanna be {rank_placeholder}, help?`,
            `any {rank_placeholder} offers?`,
            `looking to get ranked up to {rank_placeholder}`,
            `please gift me {rank_placeholder}`,
            `can i get an {rank_placeholder} upgrade?`,
            `i wish i had {rank_placeholder}`,
            `can anyone gift {rank_placeholder}?`,
            `i'm looking for {rank_placeholder}, pls`,
            `help me get {rank_placeholder}`,
            `anyone giving away {rank_placeholder}?`,
            `i'm so poor, i need {rank_placeholder}`,
            `pls i want {rank_placeholder}`,
            `{rank_placeholder} would be awesome`,
            `i'm begging for {rank_placeholder}`,
            `need an {rank_placeholder} upgrade`,
            `i'll do anything for {rank_placeholder}!`,
            `can i have {rank_placeholder} gift`,
            `can i get {rank_placeholder} pls?`,
            `i want {rank_placeholder} so i can stream`,
            `anyone nice enough to give me {rank_placeholder}?`,
            `i really need {rank_placeholder}`,
            `pls can i get {rank_placeholder}?`,
            `looking for an {rank_placeholder} friend`,
            `anyone have {rank_placeholder}?`,
            `{rank_placeholder} giveaway?`,
            `i need {rank_placeholder} bad`,
            `please gift me {rank_placeholder}`,
            `anyone wanna gift me {rank_placeholder}`,
            `can anyone upgrade me?`,
            `i want {rank_placeholder}`,
            `i need {rank_placeholder} upgrade`,
            `{rank_placeholder} plssss`,
            `any {rank_placeholder} gifts?`,
            `can i get {rank_placeholder}?`,
            `give me {rank_placeholder}!`,
            `someone gift me {rank_placeholder}`,
            `looking for {rank_placeholder}`,
            `{rank_placeholder} needed`,
            `pls i want to be {rank_placeholder}`,
            `can i get {rank_placeholder}?`,
            `i'm begging for {rank_placeholder} help`,
            `any {rank_placeholder} upgrades?`,
            `i'm so poor i need {rank_placeholder}`,
            `pls help me get {rank_placeholder}`,
            `{rank_placeholder} pls`,
            `i need an {rank_placeholder}`,
            `gift me {rank_placeholder}`,
            `can someone give {rank_placeholder}`,
            `anyone nice and gift {rank_placeholder}`,
            `looking for {rank_placeholder}, please`,
            `give me {rank_placeholder}`,
            `anyone got a {rank_placeholder}?`,
            `can i get {rank_placeholder} please?`,
            `i need {rank_placeholder} plsss`,
            `pls can i get {rank_placeholder} please`,
            `anyone has {rank_placeholder} for me`,
            `can i get {rank_placeholder} now`,
            `i want an {rank_placeholder} rank`,
            `can i have {rank_placeholder}`,
            `i need {rank_placeholder} to join guild`,
            `i want {rank_placeholder} to have fun`,
        ];

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    Rank: () => this.rank,
                    'Next Message': () => {
                        const timeLeft = Math.max(0, this.intervalSeconds * 1000 - (Date.now() - this.lastMessageTime));
                        return `${Math.ceil(timeLeft / 1000)}s`;
                    },
                },
            },
        ]);

        this.on('tick', () => {
            if (!World.isLoaded()) return;

            const currentTime = Date.now();
            const intervalMillis = this.intervalSeconds * 1000;

            if (currentTime - this.lastMessageTime >= intervalMillis) {
                this.sendBegMessage();
                this.lastMessageTime = currentTime;
            }
        });
    }

    onEnable() {
        Chat.message(`${this.name} &aEnabled.`);
        this.lastMessageTime = Date.now();
    }

    onDisable() {
        Chat.message(`${this.name} &cDisabled.`);
    }

    sendBegMessage() {
        if (this.begging_messages.length === 0) return;

        const randomMessageTemplate = this.begging_messages[Math.floor(Math.random() * this.begging_messages.length)];
        const formattedMessage = randomMessageTemplate.replace(/{rank_placeholder}/g, this.rank);

        ChatLib.say(formattedMessage);

        // tries to claim gift
        ChatLib.command('internalrankgift true');
    }
}

new AutoBeg();
