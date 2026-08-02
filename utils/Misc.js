import { chat } from './Chat';
import { getBlockInfo } from './MiningUtils';
import { v5Command } from './V5Commands';

v5Command('debug info', () => {
    let target = Player.lookingAt();
    if (!target) {
        chat('You are not looking at anything');
        return;
    }
    if (target instanceof Block) {
        const registryName = target.type?.getRegistryName?.();
        const blockInfo = getBlockInfo(registryName);
        const displayRegistry = registryName || 'unknown';

        chat('blockid: ' + (target.type?.getID?.() ?? 'unknown'));
        chat('registry: ' + displayRegistry);
        chat('x: ' + target.x + ' y: ' + target.y + ' z:' + target.z);
        if (blockInfo) {
            chat('block name: ' + blockInfo.name);
            chat('block hardness: ' + blockInfo.hardness);
        }
    } else if (target instanceof Entity) {
        chat('name: ' + target?.getName());
        chat('entity type: ' + target?.toMC()?.getType());
        chat('x: ' + target?.getX().toFixed(4) + ' y: ' + target?.getY().toFixed(4) + ' z:' + target?.getZ().toFixed(4));
        chat('health: ' + target?.toMC()?.getHealth());
        chat('max health: ' + target?.toMC()?.getMaxHealth());
        chat('UUID: ' + target?.getUUID());
    } else {
        chat('You are not looking at a block or item');
    }
});

v5Command('debug istranslucent', () => {
    const block = Player.lookingAt();
    if (!block) {
        chat('You are not looking at a block');
        return;
    }
    chat(block?.type?.isTranslucent());
});
