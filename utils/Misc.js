import { Chat } from './Chat';
import { MiningUtils } from './MiningUtils';
import { v5Command } from './V5Commands';

v5Command('debug info', () => {
    let target = Player.lookingAt();
    if (!target) {
        Chat.message('You are not looking at anything');
        return;
    }
    if (target instanceof Block) {
        const registryName = target.type?.getRegistryName?.();
        const blockInfo = MiningUtils.getBlockInfo(registryName);
        const displayRegistry = registryName || 'unknown';

        Chat.message('blockid: ' + (target.type?.getID?.() ?? 'unknown'));
        Chat.message('registry: ' + displayRegistry);
        Chat.message('x: ' + target.x + ' y: ' + target.y + ' z:' + target.z);
        if (blockInfo) {
            Chat.message('block name: ' + blockInfo.name);
            Chat.message('block hardness: ' + blockInfo.hardness);
        }
    } else if (target instanceof Entity) {
        Chat.message('name: ' + target?.getName());
        Chat.message('entity type: ' + target?.toMC()?.getType());
        Chat.message('x: ' + target?.getX().toFixed(4) + ' y: ' + target?.getY().toFixed(4) + ' z:' + target?.getZ().toFixed(4));
        Chat.message('health: ' + target?.toMC()?.getHealth());
        Chat.message('max health: ' + target?.toMC()?.getMaxHealth());
        Chat.message('UUID: ' + target?.getUUID());
    } else {
        Chat.message('You are not looking at a block or item');
    }
});

v5Command('debug istranslucent', () => {
    const block = Player.lookingAt();
    if (!block) {
        Chat.message('You are not looking at a block');
        return;
    }
    Chat.message(block?.type?.isTranslucent());
});

// gemini made it for me :)
v5Command(
    'debug packetinfo',
    (args) => {
        if (!args || args.length === 0) return Chat.message('no packet');

        const fullClassPath = args;
        let loadedClass = null;

        try {
            // TODO: resolve fullClassPath callers explicitly if dynamic packet loading needs Mojmap-specific handling.
            loadedClass = Java.type(fullClassPath);
        } catch (e) {
            return Chat.message('Packet not found');
        }

        if (!loadedClass || !loadedClass.class) return Chat.message('class not found');

        const simplePacketName = fullClassPath.substring(fullClassPath.lastIndexOf('.') + 1);

        let output = `\nPacket Checked: §6${simplePacketName}§r\n`;

        const fields = loadedClass.class.getDeclaredFields();
        output += '\n§b§nFields & Enums §r\n';

        if (fields.length === 0) {
            output += '§8No public fields found.\n';
        } else {
            fields.forEach((field) => {
                const fieldType = field.getType();
                const fieldName = field.getName();

                if (fieldType.isEnum() && fieldType.getName().includes('$')) {
                    const enumSimpleName = fieldType.getSimpleName();
                    output += `\n§aEnum: §e${enumSimpleName} §7(Field: ${fieldName})`;

                    const constants = Array.from(fieldType.getEnumConstants())
                        .map((constant) => `\n  - §9${constant.name()}§r`)
                        .join('');

                    output += `\n  §7Constants: ${constants}`;
                } else {
                    output += `\n§fField: §f${fieldName} §7(Type: §d${fieldType.getSimpleName()}§7)`;
                }
            });
        }

        const methods = loadedClass.class.getMethods();
        output += '\n\n§b§nPublic Methods §r\n\n';

        if (methods.length === 0) {
            output += '§8No public methods found.';
        } else {
            const sortedMethods = Array.from(methods).sort((a, b) => a.getName().localeCompare(b.getName()));

            sortedMethods.forEach((method) => {
                const methodName = method.getName();
                const returnType = method.getReturnType().getSimpleName();

                const paramTypes = Array.from(method.getParameterTypes())
                    .map((p) => `§d${p.getSimpleName()}§r`)
                    .join('§7, ');

                output += `§f${methodName}§7(${paramTypes}§7) §8-> §c${returnType}\n`;
            });
        }

        Chat.message(output);

        const consoleOutput = output.replace(/§[0-9a-fk-or]/g, '');
        Chat.log(consoleOutput);
    },
    ['greedyString']
);
