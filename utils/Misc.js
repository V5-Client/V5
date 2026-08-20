import { chat } from './Chat';
import { getBlockInfo } from './MiningUtils';
import { v5Command } from './V5Commands';

v5Command('debug info', () => {
    let target = Player.lookingAt();
    if (!target) {
        chat('messages.runtime.youAreNotLookingAtAnything');
        return;
    }
    if (target instanceof Block) {
        const registryName = target.type?.getRegistryName?.();
        const blockInfo = getBlockInfo(registryName);
        const displayRegistry = registryName || 'unknown';

        chat('messages.debug.blockId', { id: target.type?.getID?.() ?? 'unknown' });
        chat('messages.debug.registry', { registry: displayRegistry });
        chat('messages.debug.blockPosition', { x: target.x, y: target.y, z: target.z });
        if (blockInfo) {
            chat('messages.debug.blockName', { name: blockInfo.name });
            chat('messages.debug.blockHardness', { hardness: blockInfo.hardness });
        }
    } else if (target instanceof Entity) {
        chat('messages.debug.entityName', { name: target?.getName() });
        chat('messages.debug.entityType', { type: target?.toMC()?.getType() });
        chat('messages.debug.entityPosition', { x: target?.getX().toFixed(4), y: target?.getY().toFixed(4), z: target?.getZ().toFixed(4) });
        chat('messages.debug.health', { health: target?.toMC()?.getHealth() });
        chat('messages.debug.maxHealth', { health: target?.toMC()?.getMaxHealth() });
        chat('messages.debug.uuid', { uuid: target?.getUUID() });
    } else {
        chat('messages.runtime.youAreNotLookingAtABlockOrItem');
    }
});

v5Command('debug istranslucent', () => {
    const block = Player.lookingAt();
    if (!block) {
        chat('messages.runtime.youAreNotLookingAtABlock');
        return;
    }
    chat(block?.type?.isTranslucent());
});
