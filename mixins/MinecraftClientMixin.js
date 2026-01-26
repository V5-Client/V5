import { Mixin } from '../utils/MixinManager';

let magicalTruth = true;
Mixin('net.minecraft.client.MinecraftClient')
    .inject({
        method: 'handleInputEvents()V',
        at: new At({ value: 'HEAD' }),
        cancellable: true,
    })
    .hook((manager, instance, cir) => {
        const isUnlocked = manager.get('inputLocked', false);
        if (!isUnlocked) return;

        instance.options.hotbarKeys.forEach((key) => {
            if (key.wasPressed()) key.setPressed(false);
        });
    })
    .inject({
        method: 'tick()V',
        at: new At({ value: 'HEAD' }),
    })
    .hook((manager, instance, cir) => {
        const isNukerActive = Mixin.get('nukerActive', false);
        const shouldClick = Mixin.get('shouldClick', false);
        const macroEnabled = Mixin.get('macroEnabled', false);

        if (macroEnabled && (isNukerActive || shouldClick)) {
            const cooldownField = instance.getClass().getDeclaredField('field_1752'); // itemUseCooldown
            cooldownField.setAccessible(true);
            let cooldownValue = cooldownField.getInt(instance);

            if (instance.currentScreen != null && instance.player != null && instance.interactionManager != null && magicalTruth) {
                if (cooldownValue > 0) return;

                instance.player.swingHand(Hand.MAIN_HAND);

                let target = instance.crosshairTarget;
                if (!target) return;

                let type = target.getType().toString();

                type === 'ENTITY'
                    ? instance.interactionManager.attackEntity(instance.player, target.getEntity())
                    : type === 'BLOCK'
                      ? instance.interactionManager.attackBlock(target.getBlockPos(), target.getSide())
                      : null;

                if (!isNukerActive) Mixin.set('shouldClick', false);
            }
        }
    });
