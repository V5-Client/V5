export const PlayerInteractBlockC2SPacket = net.minecraft.network.packet.c2s.play.PlayerInteractBlockC2SPacket;
export const PlayerActionC2SPacketAction = net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket$Action;
export const PlayerActionC2SPacket = net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket;
export const HandSwingC2SPacket = net.minecraft.network.packet.c2s.play.HandSwingC2SPacket;

export const UIRoundedRectangle = Java.type('gg.essential.elementa.components.UIRoundedRectangle');
export const UMatrixStack = Java.type('gg.essential.universal.UMatrixStack').Compat.INSTANCE;
export const ConcurrentLinkedQueue = java.util.concurrent.ConcurrentLinkedQueue;
export const AtomicBoolean = java.util.concurrent.atomic.AtomicBoolean;
export const BlockHitResult = net.minecraft.util.hit.BlockHitResult;
export const StandardCharsets = java.nio.charset.StandardCharsets;
export const BufferedInputStream = java.io.BufferedInputStream;
export const DataFlavor = java.awt.datatransfer.DataFlavor;
export const InputStreamReader = java.io.InputStreamReader;
export const FileOutputStream = java.io.FileOutputStream;
export const DataOutputStream = java.io.DataOutputStream;
export const MessageType = java.awt.TrayIcon.MessageType;
export const ProcessBuilder = java.lang.ProcessBuilder;
export const BP = net.minecraft.util.math.BlockPos;
export const Vec3d = net.minecraft.util.math.Vec3d;
export const Direction = net.minecraft.util.math.Direction;
export const ArrayLists = java.util.ArrayList;
export const SystemTray = java.awt.SystemTray;
export const TrayIcon = java.awt.TrayIcon;
export const Runtime = java.lang.Runtime;
export const Scanner = java.util.Scanner;
export const Toolkit = java.awt.Toolkit;
export const System = java.lang.System;
export const Base64 = java.util.Base64;
export const Color = java.awt.Color;
export const Matrix = UMatrixStack.get();
export const File = java.io.File;
export const URL = java.net.URL;
export const modulesDir = new File("./config/ChatTriggers/modules");
export const V5ConfigFile = new File(`${modulesDir}/V5Config/config.json`);
export const Links = {
    WEBSOCKET_URL: 'wss://backend.rdbt.top/api/chat',
    BASE_API_URL: 'https://backend.rdbt.top',
    PATHFINDER_API_URL: 'http://localhost:3000',
};

// export const Links = {
//     WEBSOCKET_URL: 'ws://127.0.0.1:8787/api/chat',
//     BASE_API_URL: 'http://127.0.0.1:8787',
//     PATHFINDER_API_URL: 'http://localhost:3000',
// };
