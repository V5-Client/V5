/* VELOCITY PACKET
register('packetReceived', (packet) => {
    let ent = Client.getMinecraft().world.getEntityById(
        Player.getPlayer().getId()
    );

    if (Player.getPlayer() !== ent) return

        ChatLib.chat(
            `PLAYERS VELOCITY ${packet.velocityX}, ${packet.velocityY}, ${packet.velocityZ}`
        );
    
}).setFilteredClass(
    net.minecraft.network.packet.s2c.play.EntityVelocityUpdateS2CPacket
);*/
