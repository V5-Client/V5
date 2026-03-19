import { Chat } from './Chat';
import { Desktop, File } from './Constants';
import { ServerInfo } from './player/ServerInfo';

const commandRegistry = new Map();

const normalizeCommandId = (id) => {
    if (!id) return '';
    const raw = String(id).trim();
    return (raw.startsWith('/') ? raw.slice(1) : raw).toLowerCase();
};

const normalizeArgs = (args) => {
    if (args.length === 1 && typeof args[0] === 'string') {
        const text = args[0].trim();
        return text ? text.split(/\s+/) : [];
    }

    const normalized = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (typeof arg !== 'string') {
            normalized.push(arg);
            continue;
        }

        const text = arg.trim();
        if (!text) continue;

        if (text.includes(' ')) {
            const parts = text.split(/\s+/);
            for (let j = 0; j < parts.length; j++) {
                normalized.push(parts[j]);
            }
        } else {
            normalized.push(text);
        }
    }

    return normalized;
};

export const v5Command = (id, callback) => {
    if (typeof callback !== 'function') return;
    const cleanId = normalizeCommandId(id);
    if (!cleanId) return;
    commandRegistry.set(cleanId, callback);
};

export const callCommand = (id, ...args) => {
    const cleanId = normalizeCommandId(id);
    const callback = commandRegistry.get(cleanId);
    if (!callback) return false;

    try {
        callback(...normalizeArgs(args));
        return true;
    } catch (e) {
        Chat.message(`&cInternal command failed: &f${cleanId}`);
        console.error('V5 command execution failed:', cleanId, e);
        return false;
    }
};

const { buildCommand, registerCommand, redirect } = Commands;

const v5Logic = () => {
    const { literal, argument, greedyString, integer, exec, float } = Commands;

    const usage = (text) => Chat.message(`&cUsage: &7${text}`);
    const run = (id, ...args) => callCommand(id, ...args);
    const runOrForward = (internalId, fallbackCommand, ...args) => {
        if (run(internalId, ...args)) return;
        const joined = [fallbackCommand, ...normalizeArgs(args)].join(' ').trim();
        if (joined) ChatLib.command(joined);
    };

    const showHelp = () => {
        Chat.message('&bV5 Command Help:');
        Chat.message('&7/v5 gui &f- Open the main GUI');
        Chat.message('&7/v5 tps | /v5 ping &f- Show server TPS and ping');
        Chat.message('&7/v5 clip save &f- Save latest recording');
        Chat.message('&7/v5 mining <stats|refuel|maxge|gemstone|ore> ...');
        Chat.message('&7/v5 path <goto|fly|stop> ... &f- Pathfinder utilities');
        Chat.message('&7/v5 farming set <start|end> &f- Configure Garden warps');
        Chat.message('&7/v5 routes <action> [movement] [index] &f- Route Walker routes');
        Chat.message('&7/v5 dr ... or /v5 dungeonroutes ...');
        Chat.message('&7/v5 debug <blockinfo|istranslucent|packetinfo> ...');
    };

    const toMinecraftHexColor = (hexValue) => {
        const hex = Number(hexValue).toString(16).padStart(6, '0');
        return `§x§${hex[0]}§${hex[1]}§${hex[2]}§${hex[3]}§${hex[4]}§${hex[5]}`;
    };

    const showServerInfo = () => {
        const { tps, ping } = ServerInfo.getServerInfo();
        const tpsColor = toMinecraftHexColor(ServerInfo.getTpsColor(tps));
        const pingColor = toMinecraftHexColor(ServerInfo.getPingColor(ping));
        Chat.message(`TPS ${tpsColor}${tps}&f | Ping ${pingColor}${ping}ms`);
    };

    exec((ctx = {}) => {
        if (!ctx.args || (typeof ctx.args === 'string' && ctx.args.trim() === '')) {
            run('gui');
        }
    });

    literal('help', () => exec(showHelp));

    literal('config', () => {
        exec(() => {
            const path = new File(Client.getMinecraft().runDirectory, 'config/ChatTriggers/modules/V5Config');
            const file = new File(path);
            try {
                Desktop.getDesktop().open(file);
            } catch (error) {
                try {
                    net.minecraft.util.Util.getOperatingSystem().open(file);
                    return;
                } catch (fallbackError) {
                    Chat.message('&eUnable to open config folder automatically.');
                    Chat.message(`&7Path: &f${file.getAbsolutePath()}`);
                }
            }
        });
    });

    literal('gui', () => exec(() => run('gui')));

    literal('clip', () => {
        exec(() => run('clip'));
        literal('save', () => exec(() => run('clip')));
        literal('compress-latest', () => exec(() => run('clip', 'compress')));
    });

    literal('irc', () => {
        exec(() => run('reconnectIRC'));
        literal('reconnect', () => exec(() => run('reconnectIRC')));
    });

    literal('farming', () => {
        exec(() => usage('/v5 farming set <start|end>'));
        literal('set', () => {
            exec(() => usage('/v5 farming set <start|end>'));
            literal('start', () => exec(() => run('setstart')));
            literal('end', () => exec(() => run('setend')));
        });
    });

    literal('mining', () => {
        exec(() => usage('/v5 mining <stats|refuel|maxge|gemstone|ore> [args]'));

        literal('stats', () => exec(() => run('getminingstats')));
        literal('refuel', () => exec(() => run('refueldrill')));
        literal('maxge', () => exec(() => run('maxge')));

        literal('gemstone', () => {
            exec(() => usage('/v5 mining gemstone <args>'));
            argument('args', greedyString(), () => exec(({ args }) => ChatLib.command('gemstone ' + args)));
        });

        literal('ore', () => {
            exec(() => usage('/v5 mining ore <args>'));
            argument('args', greedyString(), () => exec(({ args }) => callCommand('ore', args)));
        });
    });

    literal('path', () => {
        exec(() => usage('/v5 path <goto|fly|stop> ...'));

        literal('goto', () => {
            exec(() => usage('/v5 path goto <x> <y> <z> [x2 y2 z2 ...]'));
            argument('args', greedyString(), () => exec(({ args }) => run('path', args)));
        });

        literal('fly', () => {
            exec(() => usage('/v5 path fly <x> <y> <z> [x2 y2 z2 ...]'));
            argument('args', greedyString(), () => exec(({ args }) => run('flypath', args)));
        });

        literal('stop', () => exec(() => run('stopPath')));
    });

    literal('nuker', () => {
        exec(() => usage('/v5 nuker <nuke|add|remove|list|clear>'));
        literal('nuke', () => exec(() => run('nukeit')));
        literal('add', () => exec(() => run('nukeradd')));
        literal('remove', () => {
            exec(() => usage('/v5 nuker remove <id>'));
            argument('id', integer(), () => exec(({ id }) => run('nukerremove', id)));
        });
        literal('list', () => exec(() => run('nukerlist')));
        literal('clear', () => exec(() => run('nukerclear')));
    });

    literal('visuals', () => {
        exec(() => usage('/v5 visuals gif <list|pick|toggle>'));
        literal('gif', () => {
            exec(() => usage('/v5 visuals gif <list|pick|toggle>'));
            literal('list', () => exec(() => ChatLib.command('gif list')));
            literal('pick', () => {
                exec(() => usage('/v5 visuals gif pick <index>'));
                argument('index', integer(), () => exec(({ index }) => ChatLib.command('gif pick ' + index)));
            });
            literal('toggle', () => exec(() => ChatLib.command('gif toggle')));
        });
    });

    literal('routes', () => {
        exec(() => usage('/v5 routes <add|remove|clear> [movement] [index]'));
        argument('args', greedyString(), () => exec(({ args }) => run('routewalker', args)));
    });

    // rdbt hasn't pushed dungeonroutes yet, commenting out rn.
    // literal('dr', () => {
    //     exec(() => runOrForward('dr', 'dr'));
    //     argument('args', greedyString(), () => exec(({ args }) => runOrForward('dr', 'dr', args)));
    // });

    // literal('dungeonroutes', () => {
    //     exec(() => runOrForward('dungeonroutes', 'dungeonroutes'));
    //     argument('args', greedyString(), () => exec(({ args }) => runOrForward('dungeonroutes', 'dungeonroutes', args)));
    // });

    literal('rotations', () => {
        exec(() => usage('/v5 rotations <rotateTo|stop> ...'));
        literal('rotateTo', () => {
            exec(() => usage('/v5 rotations rotateTo <yaw> <pitch> | random'));
            argument('yaw', float(), () => {
                argument('pitch', float(), () => exec(({ yaw, pitch }) => run('rotateTo', yaw, pitch)));
            });

            literal('random', () => {
                exec(() => {
                    const randomYaw = Math.random() * 360 - 180;
                    const randomPitch = Math.random() * 180 - 90;
                    run('rotateTo', randomYaw, randomPitch);
                });
            });
        });

        literal('stop', () => exec(() => runOrForward('stopRotation', 'stopRotation')));
    });

    literal('tps', () => exec(showServerInfo));
    literal('ping', () => exec(showServerInfo));

    literal('debug', () => {
        exec(() => usage('/v5 debug <blockinfo|istranslucent|packetinfo>'));
        literal('blockinfo', () => exec(() => run('blockinfo')));
        literal('istranslucent', () => exec(() => run('istranslucent')));
        literal('packetinfo', () => {
            exec(() => usage('/v5 debug packetinfo <packetClass>'));
            argument('className', greedyString(), () => exec(({ className }) => run('packetinfo', className)));
        });
    });
};

const v5Node = buildCommand('v5', v5Logic);
v5Node.register();

registerCommand('V5', () => redirect(v5Node));
