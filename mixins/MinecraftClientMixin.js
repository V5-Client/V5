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
    })

    .inject({
        method: 'tick()V',
        at: new At({ value: 'HEAD' }),
    })
    .hook((manager, instance, cir) => {
        const options = instance.options;
        const perspectiveEnum = net.minecraft.client.option.Perspective;
        const int = java.lang.Integer;

        const currentDist = options.getViewDistance().getValue();
        const currentPers = options.getPerspective();
        const currentFps = options.getMaxFps().getValue();

        const macroEnabled = Mixin.get('macroEnabled', false);
        const renderLimiter = Mixin.get('renderLimiter', 'Off');
        const forcePerspective = Mixin.get('forcePerspective', false);
        const limitFps = Mixin.get('limitFps', false);

        if (macroEnabled) {
            if (Mixin.get('savedDistance') == null) Mixin.set('savedDistance', currentDist);
            if (Mixin.get('savedPerspective') == null) Mixin.set('savedPerspective', currentPers);
            if (Mixin.get('savedFps') == null) Mixin.set('savedFps', currentFps);

            if (renderLimiter === 'Limit Chunks' && currentDist !== 2) {
                options.getViewDistance().setValue(new int(2));
            }

            if (limitFps) {
                options.getMaxFps().setValue(new int(30));
            }

            if (forcePerspective && currentPers !== perspectiveEnum.THIRD_PERSON_BACK) {
                options.setPerspective(perspectiveEnum.THIRD_PERSON_BACK);
            }
        } else if (!macroEnabled) {
            const savedDistance = Mixin.get('savedDistance');
            const savedPerspective = Mixin.get('savedPerspective');
            const savedFps = Mixin.get('savedFps');

            if (savedDistance != null) {
                if (currentDist !== savedDistance) {
                    options.getViewDistance().setValue(new int(savedDistance));
                }
                Mixin.set('savedDistance', null);
            }

            if (savedPerspective != null) {
                if (currentPers !== savedPerspective) {
                    options.setPerspective(savedPerspective);
                }
                Mixin.set('savedPerspective', null);
            }

            if (savedFps != null) {
                if (currentFps !== savedFps) {
                    let restoreValue = savedFps > 240 ? 260 : savedFps;
                    options.getMaxFps().setValue(new int(restoreValue));
                }
                Mixin.set('savedFps', null);
            }
        }
    });
