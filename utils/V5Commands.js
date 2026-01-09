import { Chat } from './Chat';

Commands.registerCommand('v5', () => {
    const { literal, argument, greedyString, integer, exec, float } = Commands;

    exec(() => {
        try {
            ChatLib.command('gui');
        } catch (e) {
            Chat.message('&cGUI failed to open.');
        }
    });

    /* ---------- Help ---------- */
    literal('help', () => {
        exec(() => {
            Chat.message('&bV5 Command Help:');
            Chat.message('&7/v5 gui &f- Open the main GUI');
            Chat.message('&7/v5 clip save &f- Save latest recording');
            Chat.message('&7/v5 mining (stats | refuel | maxge) &f');
            Chat.message('&7/v5 path ... &f- Pathfinder utilities');
            Chat.message('&7/v5 farming set <start|end> &f- Configure Garden warps');
            Chat.message('&7/v5 routes walker ... &f- Route Walker routes');
            Chat.message('&7/v5 mining (gemstone | ore) ... &f- Mining routes');
            Chat.message('&7/v5 webhook ... &f- Set discord webhook');
        });
    });

    /* ---------- GUI ---------- */
    literal('gui', () => {
        exec(() => {
            try {
                ChatLib.command('gui');
            } catch (e) {
                Chat.message('&cGUI failed to open.');
            }
        });
    });

    /* ---------- Clipping ---------- */
    literal('clip', () => {
        exec(() => {
            ChatLib.command('clip');
        });
        literal('save', () => {
            exec(() => {
                ChatLib.command('clip');
            });
        });

        literal('compress-latest', () => {
            exec(() => {
                ChatLib.command('clip compress');
            });
        });
    });

    /* ---------- IRC / Backend ---------- */
    literal('irc', () => {
        exec(() => {
            ChatLib.command('reconnectIRC');
        });
        literal('reconnect', () => {
            exec(() => {
                ChatLib.command('reconnectIRC');
            });
        });
    });

    /* ---------- Farming ---------- */
    literal('farming', () => {
        literal('set', () => {
            literal('start', () => {
                exec(() => {
                    ChatLib.command('setstart');
                });
            });

            literal('end', () => {
                exec(() => {
                    ChatLib.command('setend');
                });
            });
        });
    });

    /* ---------- Mining Utilities ---------- */
    literal('mining', () => {
        literal('stats', () => {
            exec(() => {
                ChatLib.command('getminingstats');
            });
        });

        literal('refuel', () => {
            exec(() => {
                ChatLib.command('refueldrill');
            });
        });

        literal('maxge', () => {
            exec(() => {
                ChatLib.command('maxge');
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
            argument('x', integer(), () => {
                argument('y', integer(), () => {
                    argument('z', integer(), () => {
                        exec(({ x, y, z }) => {
                            ChatLib.command('path ' + x + ' ' + y + ' ' + z);
                        });
                    });
                });
            });
        });

        literal('between', () => {
            argument('x1', integer(), () => {
                argument('y1', integer(), () => {
                    argument('z1', integer(), () => {
                        argument('x2', integer(), () => {
                            argument('y2', integer(), () => {
                                argument('z2', integer(), () => {
                                    // Normal follow
                                    exec(({ x1, y1, z1, x2, y2, z2 }) => {
                                        ChatLib.command('rustpath ' + x1 + ' ' + y1 + ' ' + z1 + ' ' + x2 + ' ' + y2 + ' ' + z2);
                                    });

                                    // Render-only variant
                                    literal('renderonly', () => {
                                        exec(({ x1, y1, z1, x2, y2, z2 }) => {
                                            ChatLib.command('rustpath ' + x1 + ' ' + y1 + ' ' + z1 + ' ' + x2 + ' ' + y2 + ' ' + z2 + ' renderonly');
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        literal('stop', () => {
            exec(() => {
                ChatLib.command('stop');
            });
        });
    });

    /* ---------- Webhooks ---------- */
    literal('webhook', () => {
        exec(() => {
            ChatLib.command('setwh');
        });
        literal('set-from-clipboard', () => {
            exec(() => {
                ChatLib.command('setwh');
            });
        });

        literal('userid', () => {
            argument('id', greedyString(), () => {
                exec(({ id }) => {
                    ChatLib.command('setid ' + id);
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

    /* ---------- Other / Utilities ---------- */
    literal('other', () => {
        literal('bookname', () => {
            argument('name', greedyString(), () => {
                exec(({ name }) => {
                    ChatLib.command('bookname ' + name);
                });
            });
        });

        literal('polar', () => {
            exec(() => {
                ChatLib.command('polar');
            });
        });
    });

    /* ---------- Routes / Walker ---------- */
    literal('routes', () => {
        literal('walker', () => {
            argument('args', greedyString(), () => {
                exec(({ args }) => {
                    ChatLib.command('routewalker ' + args);
                });
            });
        });
    });

    /* ---------- Rotations ---------- */
    literal('rotations', () => {
        literal('rotateTo', () => {
            argument('yaw', float(), () => {
                argument('pitch', float(), () => {
                    exec(({ yaw, pitch }) => {
                        ChatLib.command('rotateTo ' + yaw + ' ' + pitch);
                    });
                });
            });

            literal('random', () => {
                exec(() => {
                    const randomYaw = Math.random() * 360 - 180;
                    const randomPitch = Math.random() * 180 - 90;
                    ChatLib.command('rotateTo ' + randomYaw + ' ' + randomPitch);
                });
            });
        });

        literal('stop', () => {
            exec(() => {
                ChatLib.command('stopRotation');
            });
        });
    });

    /* ---------- Debug / Misc ---------- */
    literal('debug', () => {
        literal('blockinfo', () => {
            exec(() => {
                ChatLib.command('blockinfo');
            });
        });

        literal('istranslucent', () => {
            exec(() => {
                ChatLib.command('istranslucent');
            });
        });

        literal('packetinfo', () => {
            argument('className', greedyString(), () => {
                exec(({ className }) => {
                    ChatLib.command('packetinfo ' + className);
                });
            });
        });
    });
});
