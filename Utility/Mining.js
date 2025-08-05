let S2DWindowPacket = Java.type(
  "net.minecraft.network.protocol.game.ClientboundOpenScreenPacket"
);

let S30WindowPacket = Java.type(
  "net.minecraft.network.protocol.game.ClientboundContainerSetContentPacket"
);

import { Chat } from "./Prefix";
import { Time } from "./Timing";
import { Calculations } from "./Math";
import { ItemObject } from "../utils/dataclasses/ItemObject";
// utils
import { Clicking } from "./Inventory";
import { Invoking } from "./Invoking";
