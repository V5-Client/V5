import { attachMixin } from '../utils/AttachMixin';

const yggdrasilServicesKeyInfoMixin = new Mixin('com.mojang.authlib.yggdrasil.YggdrasilServicesKeyInfo');

const yggdrasilServicesKeyInfo_rsaNuker = yggdrasilServicesKeyInfoMixin.redirect({
    method: 'validateProperty(Lcom/mojang/authlib/properties/Property;)Z',
    at: new At({
        value: 'INVOKE',
        target: 'Lorg/slf4j/Logger;error(Ljava/lang/String;Ljava/lang/Object;Ljava/lang/Object;)V',
    }),
});

export const rsaNuker = attachMixin(yggdrasilServicesKeyInfo_rsaNuker, 'YggdrasilServicesKeyInfo', () => {});
