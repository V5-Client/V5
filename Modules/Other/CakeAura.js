import { ModuleBase } from '../../Utility/ModuleBase';
import { Chat } from '../../Utility/Chat';
import { MathUtils } from '../../Utility/Math';
import { Utils } from '../../Utility/Utils';
import RenderUtils from '../../Rendering/RendererUtils';
import { Vec3d } from '../../Utility/Constants';

const cakeTextures = [
    'ewogICJ0aW1lc3RhbXAiIDogMTY0Nzk1NDY2NDEyNywKICAicHJvZmlsZUlkIiA6ICI1MTY4ZjZlMjIyM2E0Y2FjYjdiN2QyZjYyZWMxZGFhOSIsCiAgInByb2ZpbGVOYW1lIiA6ICJkZWZfbm90X2FzaCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9mYjdjZmJiNmFmNzAwZTQ5YmZkYjYwMjM2OTIwYzUyMjA4NGJiODA4YWI2MTI0NzRmYjFmODNlYTQxMGQ1NDg0IgogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTY1MjgwMzkwNTI0NSwKICAicHJvZmlsZUlkIiA6ICIzNTE2NjhhMTk5MmM0ZGZlOWRkNmY5NTUxNWFkNzVmNyIsCiAgInByb2ZpbGVOYW1lIiA6ICJCbHVlX1BrIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2Q0MGY5Mjk5NTA4Mzg3NjE4Y2ZhZDZkYjM1YzlmNmQ4MDdjNDkzMzdkMzMzZDZlYzNiMTNkOWU4N2QwZDQ4OGYiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTcxOTQ1Njk0MzMwMiwKICAicHJvZmlsZUlkIiA6ICI3MzE4MWQxZDRjYWQ0ZmU0YTcxNWNjNmUxOGNjYzVkNyIsCiAgInByb2ZpbGVOYW1lIiA6ICJaZmVybjRuZGl0byIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9lMTJhMjhlNjlkYTVlNDNjZThmZGVjYzZhODIzYzkyZmZmODQ3MTllMDE0N2NhYWM3MWM1YzhkOTlkYTU3ODFjIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTY0Nzk1NDY0ODIwMCwKICAicHJvZmlsZUlkIiA6ICI4Zjk3NzhmNWVhMTY0MDVmOWEwMDM0YjU4YjljMWM2MCIsCiAgInByb2ZpbGVOYW1lIiA6ICJ1bm5hbWVkYXV0aG9yIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2JhMGE1YjUxMGE4ZDgyNGZmNDkxMGNhNWIyNjk4YWEzZDAzMGY4Mzc4MTBlOGQ3ZjBiYmNhOGNmMDZjZTIwMjMiCiAgICB9CiAgfQp9',
    'ewogICJ0aW1lc3RhbXAiIDogMTY2MDEwMzYwODk2NywKICAicHJvZmlsZUlkIiA6ICI3NTE0NDQ4MTkxZTY0NTQ2OGM5NzM5YTZlMzk1N2JlYiIsCiAgInByb2ZpbGVOYW1lIiA6ICJUaGFua3NNb2phbmciLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvNTBmMTQ0ZmQ0ZDdjODllMDNmMzVkN2VmZTQxZDM5NzgzOTY4MjM1OTE2YTAwOWU0ZDBmODgyZWMyYzhlNmViNyIKICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcxOTQ1NzE2MTczOSwKICAicHJvZmlsZUlkIiA6ICI4MDBmNmU2ZGNiMTk0Yzc2OGE1OWU1Y2Q2MzFlNjI2YyIsCiAgInByb2ZpbGVOYW1lIiA6ICJ5dXl1dXUxIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2Y1OGNkMjc1MDg4NDQ3MWMwODM2MzQzMzQzZWM2ZTE4ODIyOWRhMDU0ZWYzNjcxMDEzYWU4ZDQzZDZiMDI1NDgiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTcxOTQ1NjgzMDYzNiwKICAicHJvZmlsZUlkIiA6ICJlZGUyYzdhMGFjNjM0MTNiYjA5ZDNmMGJlZTllYzhlYyIsCiAgInByb2ZpbGVOYW1lIiA6ICJ0aGVEZXZKYWRlIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzVlZmYwOTA0ZDVlYzY5MWRkOGUzOGQxZjYzZDM4YmVmMDQ5MjAxM2VjZTkzZDMyYWY5MGRjMDMyMDExNmM1OTciLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTcyOTYxOTM4NjE2NCwKICAicHJvZmlsZUlkIiA6ICIzZGE2ZDgxOTI5MTY0MTNlODhlNzg2MjQ3NzA4YjkzZSIsCiAgInByb2ZpbGVOYW1lIiA6ICJGZXJTdGlsZSIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS80OThjODhkYWZlMTMzZTc5N2YyOTk0YWNjMDUzYjM5MjZlOTI5MWQwYjcwOTM1OThiMzlkMjcyYzdjOTRhMzY2IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcyMjMwMDI1NDI3MSwKICAicHJvZmlsZUlkIiA6ICIwYTUzMDU0MTM4YWI0YjIyOTVhMGNlZmJiMGU4MmFkYiIsCiAgInByb2ZpbGVOYW1lIiA6ICJQX0hpc2lybyIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9lMjU1ODg5OTliNjc0YjM5OWExOTgwYTI1ZDljYTMyMzYzOWQwMzNlM2Y4NTA0MGMxZGU3ZmZiNDI4YmNhMDk1IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcxOTQ1NjkxMjk0OCwKICAicHJvZmlsZUlkIiA6ICI1ZjU5NmViY2JlOTQ0NmQxYmI0M2JlNGYzZjRiOGJlNSIsCiAgInByb2ZpbGVOYW1lIiA6ICJUZWlsMHNzIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzY0NTkyNzQ2Y2MzNTY3MmVlMjliYjNhMTUzZDc0ZjdhNWQwZTVmZTg2MTI3MjlhMzRmYWQyNTJmZTc5MDQyODMiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==',
    'ewogICJ0aW1lc3RhbXAiIDogMTY0Nzk1NDY4MzMwMCwKICAicHJvZmlsZUlkIiA6ICJlMmVkYTM1YjMzZGU0M2UxOTVhZmRkNDgxNzQ4ZDlhOSIsCiAgInByb2ZpbGVOYW1lIiA6ICJDaGFsa19SaWNlR0kiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYjIzN2NkZmQ3ZDNmMjBlMGY1YjY5N2EyMGM4NTMyNGZiYjdiY2Q0MDllNjUzMzM3Y2NkNWE5Y2U4Y2NhZmMxZCIKICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcyMjI3MzY1NzM1NCwKICAicHJvZmlsZUlkIiA6ICJjOTAzOGQzZjRiMTg0M2JiYjUwNTU5ZGE3MWFjMTk2MiIsCiAgInByb2ZpbGVOYW1lIiA6ICJUQk5SY29vbGNhdCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9iYTdiZmE4MGE4NWU3MDdlZWRmOTQ1Yjg4OTA1OTQyZjVmNzc5NWVhNTI2NGQ2OTJhMjJlNzA3ZmM1NzdhODhiIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcyOTYxOTQ4NTk3OCwKICAicHJvZmlsZUlkIiA6ICIyYjcyZWYyYWUzMmQ0Zjc1OGEyMThlMDI4MTViYmNjZSIsCiAgInByb2ZpbGVOYW1lIiA6ICJ2b2xrb2RhZl82MyIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9kMzdiMWZiNGQwOTgxOTAxYTI5MmM0MmM2NTM5NDZjYTBlMmRlYTE4YmU5Y2FmYTJmMmY5OTMzZmRhYmFhOTg0IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcyMjI5OTg2NzkxMiwKICAicHJvZmlsZUlkIiA6ICJmMjU5MTFiOTZkZDU0MjJhYTcwNzNiOTBmOGI4MTUyMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJmYXJsb3VjaDEwMCIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS8yNWQ5MjQzYzYxZTJjM2UxZTBmOTkzMTg0M2NhZGJkMGRmZjRhNjQ2MjI1ZWY1NGM1NTc5NzljZjM5YmIyMDU3IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
    'ewogICJ0aW1lc3RhbXAiIDogMTcwODM1MTMzMjczMSwKICAicHJvZmlsZUlkIiA6ICJmOGJmNDBjOWExYzY0ZTllOTIyZTc4M2UwMzNiODBiMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJUeGxvbjUiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvMjExODU2NzY0MTY2NTNiZjcwNjAzYzcyM2ZmN2E0OGUwODBkYjY0OWE4Y2U1ZDY1YjQ2MWJmNjU0ODc0OTM1YSIsCiAgICAgICJtZXRhZGF0YSIgOiB7CiAgICAgICAgIm1vZGVsIiA6ICJzbGltIgogICAgICB9CiAgICB9CiAgfQp9',
    'ewogICJ0aW1lc3RhbXAiIDogMTY1MjgwNDA3NTczNSwKICAicHJvZmlsZUlkIiA6ICIwYmM5ZDc3YmQ1YTA0NWMzOTY4MWUzYTRhNDIzODZlMyIsCiAgInByb2ZpbGVOYW1lIiA6ICJWaXRvcmlpaW5oYSIsCiAgInNpZ25hdHVyZVJlcXVpcmVkIiA6IHRydWUsCiAgInRleHR1cmVzIiA6IHsKICAgICJTS0lOIiA6IHsKICAgICAgInVybCIgOiAiaHR0cDovL3RleHR1cmVzLm1pbmVjcmFmdC5uZXQvdGV4dHVyZS9jMzgzMGQyMzVjOWRlNzAzOTQ2ODY0YzI4MWY0MmY5ZDQ1NjQ3NjkxZWUzNTNmYmJiMDcyMjcxNzcwNmI4YmRhIiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=',
];
class CakeAura extends ModuleBase {
    constructor() {
        super({
            name: 'Cake Aura',
            subcategory: 'Other',
            description: 'Automatically collects cakes on island',
            tooltip: 'Right-clicks cakes within 3 blocks and shows ESP',
            autoDisableOnWorldUnload: true,
        });

        this.cakeStands = [];
        this.clickedUUIDs = new Set();
        this.cakedThisTick = false;
        this.lastCakeClick = {};
        this.bindToggleKey();

        this.on('step', () => {
            this.scanForCakes();
        }).setFps(1);

        this.on('tick', () => {
            if (!this.isOnPrivateIsland()) return;
            if (this.cakedThisTick) return;

            this.cakedThisTick = false;
            this.checkAndClickCakes();
        });

        this.on('renderWorld', () => {
            if (!this.isOnPrivateIsland()) return;
            this.cakeStands.forEach((stand) => {
                const uuid = stand.getUUID()?.toString();
                if (uuid && !this.clickedUUIDs.has(uuid)) {
                    this.renderCakeESP(stand);
                }
            });
        });

        this.on('command', () => {
            this.toggle();
        }).setName('ca');
    }

    scanForCakes() {
        const allStands = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity.class);
        this.cakeStands = [];

        allStands.forEach((stand) => {
            const headItem = stand.getStackInSlot(5);
            if (!headItem) return;

            const nbtString = headItem.getNBT()?.toString();
            if (!nbtString) return;

            const valueMatch = nbtString.match(/value=([A-Za-z0-9+/=]+)/);
            if (!valueMatch) return;

            const textureValue = valueMatch[1];

            if (this.isCakeTexture(textureValue)) {
                const hasDuplicate = this.cakeStands.some((other) => {
                    if (other.getY() <= stand.getY()) return false;
                    const otherHead = other.getStackInSlot(5);
                    if (!otherHead) return false;
                    const otherNbt = otherHead.getNBT()?.toString();
                    if (!otherNbt) return false;
                    const otherMatch = otherNbt.match(/value=([A-Za-z0-9+/=]+)/);
                    return otherMatch && otherMatch[1] === valueMatch[1];
                });
                if (!hasDuplicate) {
                    this.cakeStands.push(stand);
                }
            }
        });
    }

    isCakeTexture(textureValue) {
        if (!textureValue) return false;

        try {
            const Base64 = Java.type('java.util.Base64');
            const String = Java.type('java.lang.String');

            const decoded = new String(Base64.getDecoder().decode(textureValue));
            const json = JSON.parse(decoded);
            const textureUrl = json?.textures?.SKIN?.url;

            if (!textureUrl) return false;

            return cakeTextures.some((cakeTexture) => {
                try {
                    const cakeDecoded = new String(Base64.getDecoder().decode(cakeTexture));
                    const cakeJson = JSON.parse(cakeDecoded);
                    return cakeJson?.textures?.SKIN?.url === textureUrl;
                } catch (e) {
                    return false;
                }
            });
        } catch (e) {
            return false;
        }
    }

    checkAndClickCakes() {
        if (this.cakeStands.length === 0) return;

        let clickedThisTick = false;

        for (const stand of this.cakeStands) {
            const uuid = stand.getUUID()?.toString();
            if (!uuid) continue;

            if (this.clickedUUIDs.has(uuid)) continue;

            const eyePos = this.getEyePos();
            const cakePos = [stand.getX() + 0.5, stand.getY() + 1, stand.getZ() + 0.5]; // arbitrary offset, probably not working
            const dist = MathUtils.calculateDistance(eyePos, cakePos);

            Chat.debugMessage(`Cake at ${cakePos} - Distance: ${dist.distance.toFixed(2)}`);

            if (dist.distance < 3) {
                if (!clickedThisTick) {
                    Chat.debugMessage(`Clicking cake ${this.clickedUUIDs.size + 1}/${this.cakeStands.length}`);
                    this.rightClickEntity(stand);
                    this.clickedUUIDs.add(uuid);
                    clickedThisTick = true;

                    if (this.clickedUUIDs.size >= this.cakeStands.length) {
                        Chat.message('&a&lFinished collecting all cakes!');
                        this.toggle(false);
                    }
                }
            }
        }

        if (clickedThisTick) {
            Chat.debugMessage(`Total clicked: ${this.clickedUUIDs.size}/${this.cakeStands.length}`);
        }
    }

    rightClickEntity(entity) {
        try {
            const hand = net.minecraft.util.Hand.MAIN_HAND;
            const sneaking = Player.asPlayerMP().isSneaking();
            const minecraftEntity = entity.mcValue;

            const packet = net.minecraft.network.packet.c2s.play.PlayerInteractEntityC2SPacket.interact(minecraftEntity, sneaking, hand);

            Client.sendPacket(packet);

            Player.getPlayer().swingHand(hand);

            return true;
        } catch (e) {
            Chat.debugMessage('Failed to right click entity: ' + e);
            return false;
        }
    }

    renderCakeESP(entity) {
        try {
            const pos = new Vec3d(entity.getX(), entity.getY(), entity.getZ());
            const fillColor = [255, 255, 255, 80];
            const outlineColor = [0, 255, 255, 255];
            RenderUtils.drawStyledBox(pos, fillColor, outlineColor, 4, true);
        } catch (e) {}
    }

    getEyePos() {
        const eyeVec = Player.getPlayer().getEyePos();
        return [eyeVec.x, eyeVec.y, eyeVec.z];
    }

    inSkyblock() {
        const title = Scoreboard.getTitle();
        if (!title) return false;
        const cleanTitle = ChatLib.removeFormatting(title).replace(/\s+/g, '');
        return cleanTitle.startsWith('SKYBLOCK');
    }

    isOnPrivateIsland() {
        if (!this.inSkyblock()) return false;
        const area = Utils.area();
        return area === 'Private Island' || area.includes('Private Island');
    }

    onEnable() {
        this.clickedUUIDs.clear();
        this.cakeStands = [];
        this.scanForCakes();
        Chat.message('&a&lCake Aura enabled!');
    }

    onDisable() {
        this.clickedUUIDs.clear();
        this.cakeStands = [];
        Chat.message('&c&lCake Aura disabled!');
    }
}

new CakeAura();
