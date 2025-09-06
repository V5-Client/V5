import { Keybind } from '../../Utility/Keybinding';
import { Chat } from '../../Utility/Chat';
import { Guis } from '../../Utility/Inventory';

let time = Date.now();
let boomSlot = 1;
let rodSlot = 0;
let trackedStand = null;

register('tick', () => {
    if (Date.now() - time < 800) return;

    if (
        trackedStand &&
        !trackedStand.isDead() &&
        trackedStand.distanceTo(Player.getPlayer()) <= 10
    ) {
        // Stand is valid, check if it shows !!!
        if (trackedStand.getName() !== '!!!') {
            trackedStand = null; // Name changed, stop tracking
            return;
        }
    } else {
        trackedStand = null; // Stand is dead or too far
    }

    if (!trackedStand) {
        trackedStand = World.getAllEntitiesOfType(
            net.minecraft.entity.decoration.ArmorStandEntity
        ).find(
            (stand) =>
                stand.getName() === '!!!' &&
                stand.distanceTo(Player.getPlayer()) <= 10
        );

        if (trackedStand) {
            Keybind.rightClick();
            time = Date.now();
            Chat.message('Jerking off rod');
            Client.scheduleTask(2, () => {
                Guis.setItemSlot(boomSlot);
            });
            Client.scheduleTask(4, () => {
                Keybind.rightClick();
            });
            Client.scheduleTask(10, () => {
                Keybind.rightClick();
            });
            Client.scheduleTask(16, () => {
                Keybind.rightClick();
            });
            Client.scheduleTask(18, () => {
                Guis.setItemSlot(rodSlot);
            });
            Client.scheduleTask(20, () => {
                Keybind.rightClick();
            });
        }
    }
});
