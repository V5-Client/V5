import { Chat } from './Chat';
import { File, Desktop } from './Constants';
import { ServerInfo } from './player/ServerInfo';

const commands = {};

export const v5Command = (id, callback) => {
    const lowerId = id.toLowerCase();
    commands[lowerId] = callback;
};

export const callCommand = (id, ...args) => {
    const cleanId = id.startsWith('/') ? id.slice(1).toLowerCase() : id.toLowerCase();
    const callback = commands[cleanId];

    if (callback) {
        let finalArgs = args;

        if (args.length === 1 && typeof args[0] === 'string' && args[0].includes(' ')) {
            finalArgs = args[0].trim().split(/\s+/);
        }

        callback(...finalArgs);
    }
};

const { buildCommand, registerCommand, redirect } = Commands;

const v5Logic = () => {
    const { literal, argument, greedyString, integer, exec, float } = Commands;

    exec((ctx = {}) => {
        if (!ctx.args || (typeof ctx.args === 'string' && ctx.args.trim() === '')) {
            callCommand('gui');
        }
    });

    /* ---------- Help ---------- */
    literal('help', () => {
        exec(() => {
            Chat.message('&bV5 Command Help:');
            Chat.message('&7/v5 gui &f- Open the main GUI');
            Chat.message('&7/v5 tps/ping &f- Show server TPS and ping');
            Chat.message('&7/v5 clip save &f- Save latest recording');
            Chat.message('&7/v5 mining (stats | refuel | maxge) &f');
            Chat.message('&7/v5 path ... &f- Pathfinder utilities');
            Chat.message('&7/v5 farming set <start|end> &f- Configure Garden warps');
            Chat.message('&7/v5 routes walker ... &f- Route Walker routes');
            Chat.message('&7/v5 mining (gemstone | ore) ... &f- Mining routes');
            Chat.message('&7/v5 webhook ... &f- Set discord webhook');
            Chat.message('&7/v5 dr|dungeonroutes ... &f- Dungeon room waypoints');
        });
    });

    literal('config', () => {
        exec(() => {
            const path = new File(Client.getMinecraft().runDirectory, 'config/ChatTriggers/modules/V5Config');
            const file = new File(path);

            if (file.exists()) Desktop.getDesktop().open(file);
        });
    });

    /* ---------- GUI ---------- */
    literal('gui', () => {
        exec(() => {
            callCommand('gui');
        });
    });

    /* ---------- Clipping ---------- */
    literal('clip', () => {
        exec(() => {
            callCommand('clip');
        });
        literal('save', () => {
            exec(() => {
                callCommand('clip');
            });
        });

        literal('compress-latest', () => {
            exec(() => {
                callCommand('clip', 'compress');
            });
        });
    });

    /* ---------- IRC / Backend ---------- */
    literal('irc', () => {
        exec(() => {
            callCommand('reconnectIRC');
        });
        literal('reconnect', () => {
            exec(() => {
                callCommand('reconnectIRC');
            });
        });
    });

    /* ---------- Farming ---------- */
    literal('farming', () => {
        literal('set', () => {
            literal('start', () => {
                exec(() => {
                    callCommand('setstart');
                });
            });

            literal('end', () => {
                exec(() => {
                    callCommand('setend');
                });
            });
        });
    });

    /* ---------- Mining Utilities ---------- */
    literal('mining', () => {
        literal('stats', () => {
            exec(() => {
                callCommand('getminingstats');
            });
        });

        literal('refuel', () => {
            exec(() => {
                callCommand('refueldrill');
            });
        });

        literal('maxge', () => {
            exec(() => {
                callCommand('maxge');
            });
        });

        literal('gemstone', () => {
            argument('args', greedyString(), () => {
                exec(({ args }) => {
                    ChatLib.command('gemstone ' + args);
                });
            });
        });

        literal('ore', () => {
            argument('args', greedyString(), () => {
                exec(({ args }) => {
                    ChatLib.command('ore ' + args);
                });
            });
        });
    });

    /* ---------- Pathfinding ---------- */
    literal('path', () => {
        literal('goto', () => {
            argument('args', greedyString(), () => {
                exec(({ args }) => {
                    callCommand('path', args);
                });
            });
        });

        literal('fly', () => {
            argument('args', greedyString(), () => {
                exec(({ args }) => {
                    callCommand('flypath', args);
                });
            });
        });

        literal('stop', () => {
            exec(() => {
                callCommand('stopPath');
            });
        });
    });

    /* ---------- Nuker ---------- */
    literal('nuker', () => {
        literal('nuke', () => {
            exec(() => {
                callCommand('nukeit');
            });
        });
        literal('add', () => {
            exec(() => {
                callCommand('nukeradd');
            });
        });
        literal('remove', (id) => {
            argument('id', integer(), () => {
                exec(({ id }) => {
                    callCommand('nukerremove', id);
                });
            });
        });
        literal('list', () => {
            exec(() => {
                callCommand('nukerlist');
            });
        });
        literal('clear', () => {
            exec(() => {
                callCommand('nukerclear');
            });
        });
    });

    /* ---------- Webhooks ---------- */
    literal('webhook', () => {
        exec(() => {
            callCommand('setwh');
        });
        literal('set-from-clipboard', () => {
            exec(() => {
                callCommand('setwh');
            });
        });

        literal('userid', () => {
            argument('id', greedyString(), () => {
                exec(({ id }) => {
                    callCommand('setid', id);
                });
            });
        });
    });

    literal('visuals', () => {
        literal('gif', () => {
            literal('list', () => {
                exec(() => {
                    ChatLib.command('gif list');
                });
            });

            literal('pick', () => {
                argument('index', integer(), () => {
                    exec(({ index }) => {
                        ChatLib.command('gif pick ' + index);
                    });
                });
            });

            literal('toggle', () => {
                exec(() => {
                    ChatLib.command('gif toggle');
                });
            });
        });
    });

    /* ---------- Routes / Walker ---------- */
    literal('routes', () => {
        literal('walker', () => {
            argument('args', greedyString(), () => {
                exec(({ args }) => {
                    callCommand('routewalker', args);
                });
            });
        });
    });

    /* ---------- Dungeon Routes ---------- */
    literal('dr', () => {
        exec(() => {
            callCommand('dr');
        });
        argument('args', greedyString(), () => {
            exec(({ args }) => {
                callCommand('dr', args);
            });
        });
    });

    literal('dungeonroutes', () => {
        exec(() => {
            callCommand('dungeonroutes');
        });
        argument('args', greedyString(), () => {
            exec(({ args }) => {
                callCommand('dungeonroutes', args);
            });
        });
    });

    /* ---------- Rotations ---------- */
    literal('rotations', () => {
        literal('rotateTo', () => {
            argument('yaw', float(), () => {
                argument('pitch', float(), () => {
                    exec(({ yaw, pitch }) => {
                        callCommand('rotateTo', yaw, pitch);
                    });
                });
            });

            literal('random', () => {
                exec(() => {
                    const randomYaw = Math.random() * 360 - 180;
                    const randomPitch = Math.random() * 180 - 90;
                    callCommand('rotateTo', randomYaw, randomPitch);
                });
            });
        });

        literal('stop', () => {
            exec(() => {
                ChatLib.command('stopRotation');
            });
        });
    });

    /* ---------- Server Info ---------- */
    const getTpsColor = (tps) => {
        if (tps > 19.8) return '&2';
        if (tps > 19) return '&a';
        if (tps > 17.5) return '&6';
        if (tps > 12) return '&c';
        return '&4';
    };

    const getPingColor = (ping) => {
        if (ping < 50) return '&a';
        if (ping < 100) return '&2';
        if (ping < 149) return '&e';
        if (ping < 249) return '&6';
        return '&c';
    };

    const showServerInfo = () => {
        const { tps, ping } = ServerInfo.getServerInfo();
        const tpsColor = getTpsColor(tps);
        const pingColor = getPingColor(ping);
        Chat.message(`TPS ${tpsColor}${tps}&f | Ping ${pingColor}${ping}ms`);
    };

    literal('tps', () => {
        exec(() => {
            showServerInfo();
        });
    });

    literal('ping', () => {
        exec(() => {
            showServerInfo();
        });
    });

    /* ---------- Debug / Misc ---------- */
    literal('debug', () => {
        literal('blockinfo', () => {
            exec(() => {
                callCommand('blockinfo');
            });
        });

        literal('istranslucent', () => {
            exec(() => {
                callCommand('istranslucent');
            });
        });

        literal('packetinfo', () => {
            argument('className', greedyString(), () => {
                exec(({ className }) => {
                    callCommand('packetinfo', className);
                });
            });
        });
    });
};

const v5Node = buildCommand('v5', v5Logic);
v5Node.register();

registerCommand('V5', () => redirect(v5Node));
