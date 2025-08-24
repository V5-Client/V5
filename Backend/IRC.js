import WebSocket from "WebSocket";
import { Chat } from "../Utility/Chat";
import RequestV2 from "RequestV2";

//todo: 
// auto reconnect

function connectIRC(svid) {
  ws = new WebSocket("wss://client.rdbt.top/minecraft-ws");

  ws.onOpen = (handshake) => {
    Chat.irc("Connected to Minecraft WebSocket server");
    
    authenticateMojang(svid);
  };

  ws.onMessage = (message) => {
    //console.log("Received:", message);    
    try {
      const data = JSON.parse(message);
      
      switch(data.event) {
        case "auth_success":
          if (!data.data.user.discordLinked) {
            Chat.irc("Link Discord: http://client.rdbt.top/auth/discord/" + Player.getName());
            java.awt.Desktop.getDesktop().browse(new java.net.URI(`http://client.rdbt.top/auth/discord/${Player.getName()}`));
          } 
          break;          
        case "chat_message":
          const sender = data.data.sender.minecraftName || data.data.sender.discordUsername;
          Chat.irc(sender + ": " + data.data.content);
          break;
          
        case "discord_link_reminder":
          Chat.irc("Link your discord account: http://client.rdbt.top/auth/discord/" + Player.getName());
          java.awt.Desktop.getDesktop().browse(new java.net.URI(`http://client.rdbt.top/auth/discord/${Player.getName()}`));
          break;
        case "access_upgraded":
          Chat.irc("Discord linked! Full access granted.");
          break;
          
        case "error":
          Chat.irc("Error: " + data.data.message);
          break;
      }
    } catch (e) {
      Chat.irc("An error occured")
      Chat.irc(message);
    }
  };

  ws.onError = (exception) => {
    console.error("WebSocket error:", exception);
    Chat.irc("Connection error: " + exception);
  };

  ws.onClose = (code, reason, remote) => {
    console.log("WebSocket closed:", code, reason);
    Chat.irc("Disconnected from chat server");
  };

  ws.connect();
}

function authenticateMojang(svid) {
  try {
    const token = Client.getMinecraft().getSession().getAccessToken();
    const uuid = Player.getUUID().toString().replaceAll("-", "");
    const username = Player.getName();
    //Chat.message("Authenticating with Mojang...");
    RequestV2({
      url: "https://sessionserver.mojang.com/session/minecraft/join",
      method: "POST",
      body: {
        accessToken: token,
        selectedProfile: uuid,
        serverId: svid,
      },
      resolveWithFullResponse: true,
    })
      .then((response) => {
        if (response.statusCode === 204) {
          const authData = JSON.stringify({
            event: "minecraft_auth",
            data: {
              username: username,
              serverId: svid
            }
          });
          ws.send(authData);
        } else {
          Chat.irc("Failed to authenticate with Mojang.");
        }
      })
      .catch((e) => {
        Chat.irc("Authentication error: " + e);
      });
  } catch (e) {
    console.log(e);
  }
}

register("gameUnload", () => {
	ws?.close();
})

function sendChatMessage(content) {
  if (ws && ws.socket && ws.socket.isOpen()) {
    ws.send(JSON.stringify({
      event: "chat_message",
      data: {
        content: content
      }
    }));
  }
}

register("packetSent", (packet, event) => {
	let message;
	try {
		message = packet.chatMessage();
	} catch (e) {}
	if (!message || !message.startsWith("#")) return;
	try {
		sendChatMessage(message.substring(1));
	} catch (error) {
		Chat.irc("Failed to send message")
	}
	cancel(event);
}).setFilteredClass(net.minecraft.network.packet.c2s.play.ChatMessageC2SPacket)

// Start connection
connectIRC(global.APIKEY_DO_NOT_SHARE);
