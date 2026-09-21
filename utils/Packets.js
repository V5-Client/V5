import { IS_MC_26_3, MCHand } from './Constants';

// Client to server
export const ServerboundChatPacket = net.minecraft.network.protocol.game.ServerboundChatPacket;
export const ServerboundContainerClickPacket = net.minecraft.network.protocol.game.ServerboundContainerClickPacket;
export const ServerboundClientCommandPacket = net.minecraft.network.protocol.game.ServerboundClientCommandPacket;
export const ServerboundContainerClosePacket = net.minecraft.network.protocol.game.ServerboundContainerClosePacket;
export const ServerboundChatCommandPacket = net.minecraft.network.protocol.game.ServerboundChatCommandPacket;
export const ServerboundSwingPacket = Java.type(`net.minecraft.network.protocol.game.${IS_MC_26_3 ? 'ServerboundPunchPacket' : 'ServerboundSwingPacket'}`);
export const ServerboundPlayerActionPacket = net.minecraft.network.protocol.game.ServerboundPlayerActionPacket;
export const ServerboundUseItemOnPacket = net.minecraft.network.protocol.game.ServerboundUseItemOnPacket;
export const ServerboundInteractPacket = net.minecraft.network.protocol.game.ServerboundInteractPacket;
export const ServerboundUseItemPacket = net.minecraft.network.protocol.game.ServerboundUseItemPacket;
export const ServerboundPlayerActionPacket$Action = net.minecraft.network.protocol.game.ServerboundPlayerActionPacket$Action;
export const ServerboundCommandSuggestionPacket = net.minecraft.network.protocol.game.ServerboundCommandSuggestionPacket;

// Server to client
export const ClientboundBlockUpdatePacket = net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
export const ClientboundSectionBlocksUpdatePacket = net.minecraft.network.protocol.game.ClientboundSectionBlocksUpdatePacket;
export const ClientboundPingPacket = net.minecraft.network.protocol.common.ClientboundPingPacket;
export const ClientboundDisconnectPacket = net.minecraft.network.protocol.common.ClientboundDisconnectPacket;
export const ClientboundSetEntityMotionPacket = net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
export const ClientboundLoginPacket = net.minecraft.network.protocol.game.ClientboundLoginPacket;
export const ClientboundSystemChatPacket = net.minecraft.network.protocol.game.ClientboundSystemChatPacket;
export const ClientboundLoginDisconnectPacket = net.minecraft.network.protocol.login.ClientboundLoginDisconnectPacket;
export const ClientboundOpenScreenPacket = net.minecraft.network.protocol.game.ClientboundOpenScreenPacket;
export const ClientboundLevelParticlesPacket = net.minecraft.network.protocol.game.ClientboundLevelParticlesPacket;
export const ClientboundPlayerPositionPacket = net.minecraft.network.protocol.game.ClientboundPlayerPositionPacket;
export const ClientboundSetTitleTextPacket = net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
export const ClientboundSetHeldSlotPacket = net.minecraft.network.protocol.game.ClientboundSetHeldSlotPacket;
export const ClientboundAwardStatsPacket = net.minecraft.network.protocol.game.ClientboundAwardStatsPacket;
export const ClientboundLevelChunkWithLightPacket = net.minecraft.network.protocol.game.ClientboundLevelChunkWithLightPacket;

export const createSwingPacket = () => (IS_MC_26_3 ? ServerboundSwingPacket.INSTANCE : new ServerboundSwingPacket(MCHand.MAIN_HAND));

export const getLevelParticleData = (packet) => {
    if (IS_MC_26_3) {
        return {
            particle: packet.particle(),
            count: packet.count(),
            x: packet.x(),
            y: packet.y(),
            z: packet.z(),
            xDist: packet.xDist(),
            yDist: packet.yDist(),
            zDist: packet.zDist(),
            xSpeed: packet.xMaxSpeed(),
            ySpeed: packet.yMaxSpeed(),
            zSpeed: packet.zMaxSpeed(),
        };
    }

    const speed = packet.getMaxSpeed();
    return {
        particle: packet.getParticle(),
        count: packet.getCount(),
        x: packet.getX(),
        y: packet.getY(),
        z: packet.getZ(),
        xDist: packet.getXDist(),
        yDist: packet.getYDist(),
        zDist: packet.getZDist(),
        xSpeed: speed,
        ySpeed: speed,
        zSpeed: speed,
    };
};
