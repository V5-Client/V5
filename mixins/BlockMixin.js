import { Mixin } from '../utils/MixinManager';

Mixin('net.minecraft.block.Block')
    .inject({
        method: 'spawnBreakParticles',
        at: 'HEAD',
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const hideParticles = manager.get('hideParticles');
        if (!hideParticles) return;

        const blockKey = instance.getTranslationKey();

        const targetKeys = [
            'block.minecraft.melon',
            'block.minecraft.pumpkin',
            'block.minecraft.carrots',
            'block.minecraft.potatoes',
            'block.minecraft.wheat',
            'block.minecraft.nether_wart',
            'block.minecraft.sugar_cane',
            'block.minecraft.cactus',
            'block.minecraft.cocoa',
            'block.minecraft.melon_stem',
            'block.minecraft.pumpkin_stem',
            'block.minecraft.carved_pumpkin',
        ];

        const isTarget = targetKeys.some((key) => blockKey === key);

        if (isTarget) cir.cancel();
    });
