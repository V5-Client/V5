import { chat } from './Chat';
import { File } from './Constants';
import { isDeveloperModeEnabled, setDeveloperModeEnabled } from './DeveloperModeState';
import { togglePiP } from './PiP';
import { getPingColor, getServerInfo, getTpsColor } from './player/ServerInfo';

const commandRegistry = new Map();
let developerModeEnableConfirmationPending = false;

const callCommand = function (name, ...args) {
    const handler = commandRegistry.get(name)?.handler;

    try {
        if (args.length === 1 && typeof args[0] === 'string') args = args[0].trim().split(/\s+/).filter(Boolean);
        handler(...args);
    } catch (error) {
        chat(`&cInternal command failed: &f${name}`);
        console.error('V5 command execution failed:', name, error);
    }
};

const addCommands = (commands) => {
    const { argument, exec, greedyString, literal } = Commands;
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

    argument('invalid', greedyString(), () => exec(() => chat('&cInvalid command.')));
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
    chat('&bV5 Commands:');
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
        if (!args.length) return chat('&cUsage: &7/v5 mining gemstone <args>');
        ChatLib.command(`gemstone ${args.join(' ')}`);
    },
    ['greedyString']
);

v5Command('visuals gif list', () => ChatLib.command('gif list'));
v5Command(
    'visuals gif pick',
    (index) => {
        if (index === undefined) return chat('&cUsage: &7/v5 visuals gif pick <index>');
        ChatLib.command(`gif pick ${index}`);
    },
    ['integer']
);
v5Command('visuals gif toggle', () => ChatLib.command('gif toggle'));

const setDeveloperMode = (enabled) => {
    if (!enabled) {
        developerModeEnableConfirmationPending = false;
        if (!isDeveloperModeEnabled()) return chat('&cDeveloper Mode is already disabled.');

        setDeveloperModeEnabled(false);
        chat('&aDeveloper Mode disabled.');
        ChatLib.command('ct load', true);
        return;
    }

    if (isDeveloperModeEnabled()) return chat("&cDeveloper Mode enabled. Run '/V5 developerMode false' to disable.");

    if (!developerModeEnableConfirmationPending) {
        developerModeEnableConfirmationPending = true;
        chat('&cDeveloper Mode should only be enabled if you know what your doing. It will disable auto updates, unlock WIP modules, and potentially ban you.');
        chat("&cRun '/V5 developerMode true' again to confirm.");
        return;
    }

    developerModeEnableConfirmationPending = false;
    setDeveloperModeEnabled(true);
    chat('&cDeveloper Mode enabled. Auto updates are disabled and WIP modules are unlocked.');
    ChatLib.command('ct load', true);
};

v5Command('developerMode true', () => setDeveloperMode(true));
v5Command('developerMode false', () => setDeveloperMode(false));
