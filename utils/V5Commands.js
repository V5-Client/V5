import { chat } from './Chat';
import { File } from './Constants';
import { isDeveloperModeEnabled, setDeveloperModeEnabled } from './DeveloperModeState';
import { togglePiP } from './PiP';
import { getPingColor, getServerInfo, getTpsColor } from './player/ServerInfo';

const commandRegistry = new Map();
let developerModeEnableConfirmationPending = false;

const callCommand = function (name) {
    const handler = commandRegistry.get(name)?.handler;
    let args = Array.prototype.slice.call(arguments, 1);

    try {
        if (args.length === 1 && typeof args[0] === 'string') args = args[0].trim().split(/\s+/).filter(Boolean);
        handler(...args);
    } catch (error) {
        chat(`&cInternal command failed: &f${name}`);
        console.error('V5 command execution failed:', name, error);
    }
};

const addCommands = (commands) => {
    const { argument, exec, literal } = Commands;
    const children = new Map();

    const addArguments = (command, index = 0) => {
        const argumentTypes = command.argumentTypes || [];
        if (index >= argumentTypes.length) {
            exec((args) => callCommand(command.name, ...argumentTypes.map((_, argumentIndex) => args[`arg${argumentIndex}`])));
            return;
        }

        const typeFactory = Commands[argumentTypes[index]];
        argument(`arg${index}`, typeFactory(), () => addArguments(command, index + 1));
    };

    commands.forEach((command) => {
        const [head, ...tail] = command.parts;
        if (!children.has(head)) children.set(head, []);
        children.get(head).push({ ...command, parts: tail });
    });

    children.forEach((childCommands, name) => {
        literal(name, () => {
            const command = childCommands.find(({ parts }) => !parts.length);
            if (command) {
                exec(() => callCommand(command.name));
                if (command.argumentTypes?.length) addArguments(command);
            }

            addCommands(childCommands.filter(({ parts }) => parts.length));
        });
    });
};

export const registerV5Commands = () => {
    const { buildCommand, exec, redirect, registerCommand } = Commands;
    const v5Node = buildCommand('v5', () => {
        exec(() => callCommand('gui'));
        addCommands(Array.from(commandRegistry.entries(), ([name, command]) => ({ name, parts: name.split(' '), ...command })));
    });

    v5Node.register();
    registerCommand('V5', () => redirect(v5Node));
};

export const v5Command = (name, handler, argumentTypes = []) => {
    commandRegistry.set(name, { handler, argumentTypes });
};

v5Command('help', () => {
    chat('messages.runtime.v5Commands');
    for (const name of Array.from(commandRegistry.keys()).sort()) chat(`&7/v5 ${name}`);
});

v5Command('config', () => {
    FileLib.open(new File(Client.getMinecraft().gameDirectory, 'config/ChatTriggers/modules/V5Config'));
});

const showServerInfo = () => {
    const { tps, ping } = getServerInfo();
    const toColor = (value) => {
        const hex = Number(value).toString(16).padStart(6, '0');
        return `§x§${hex[0]}§${hex[1]}§${hex[2]}§${hex[3]}§${hex[4]}§${hex[5]}`;
    };
    chat(`TPS ${toColor(getTpsColor(tps))}${tps}&f | Ping ${toColor(getPingColor(ping))}${ping}ms`);
};

v5Command('tps', showServerInfo);
v5Command('ping', showServerInfo);

v5Command('pip', () => {
    togglePiP();
});

v5Command(
    'mining gemstone',
    (...args) => {
        if (!args.length) return chat('messages.runtime.usageV5MiningGemstoneArgs');
        ChatLib.command(`gemstone ${args.join(' ')}`);
    },
    ['greedyString']
);

v5Command('visuals gif list', () => ChatLib.command('gif list'));
v5Command(
    'visuals gif pick',
    (index) => {
        if (index === undefined) return chat('messages.runtime.usageV5VisualsGifPickIndex');
        ChatLib.command(`gif pick ${index}`);
    },
    ['integer']
);
v5Command('visuals gif toggle', () => ChatLib.command('gif toggle'));

const setDeveloperMode = (enabled) => {
    if (!enabled) {
        developerModeEnableConfirmationPending = false;
        if (!isDeveloperModeEnabled()) return chat('messages.runtime.developerModeIsAlreadyDisabled');

        setDeveloperModeEnabled(false);
        chat('messages.runtime.developerModeDisabled');
        ChatLib.command('ct load', true);
        return;
    }

    if (isDeveloperModeEnabled()) return chat('messages.runtime.developerModeEnabledRunV5DevelopermodeFalseToDisable');

    if (!developerModeEnableConfirmationPending) {
        developerModeEnableConfirmationPending = true;
        chat('messages.runtime.developerModeShouldOnlyBeEnabledIfYouKnowWhatYourDoingItWillDisableAutoUpdatesUnlockWipModulesAndPotentiallyBanYou');
        chat('messages.runtime.runV5DevelopermodeTrueAgainToConfirm');
        return;
    }

    developerModeEnableConfirmationPending = false;
    setDeveloperModeEnabled(true);
    chat('messages.runtime.developerModeEnabledAutoUpdatesAreDisabledAndWipModulesAreUnlocked');
    ChatLib.command('ct load', true);
};

v5Command('developerMode true', () => setDeveloperMode(true));
v5Command('developerMode false', () => setDeveloperMode(false));
