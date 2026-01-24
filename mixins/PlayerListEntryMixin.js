import { attachMixin } from '../utils/AttachMixin';

const PlayerListHud = new Mixin('net.minecraft.client.gui.hud.PlayerListHud');

export const getPlayerName = PlayerListHud.modifyReturnValue({
    method: 'getPlayerName',
    at: new At({ value: 'RETURN' }),
});
