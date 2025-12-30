export const SharedConstants = net.minecraft.SharedConstants;
export const MinecraftClient = net.minecraft.client.MinecraftClient;
export const MCHand = net.minecraft.util.Hand;

export const UIRoundedRectangle = Java.type('gg.essential.elementa.components.UIRoundedRectangle');
export const UMatrixStack = Java.type('gg.essential.universal.UMatrixStack').Compat.INSTANCE;
export const ConcurrentLinkedQueue = java.util.concurrent.ConcurrentLinkedQueue;
export const AtomicBoolean = java.util.concurrent.atomic.AtomicBoolean;
export const StandardCharsets = java.nio.charset.StandardCharsets;
export const BufferedInputStream = java.io.BufferedInputStream;
export const DataFlavor = java.awt.datatransfer.DataFlavor;
export const InputStreamReader = java.io.InputStreamReader;
export const FileOutputStream = java.io.FileOutputStream;
export const DataOutputStream = java.io.DataOutputStream;
export const MessageType = java.awt.TrayIcon.MessageType;
export const ProcessBuilder = java.lang.ProcessBuilder;
export const ArrayLists = java.util.ArrayList;
export const SystemTray = java.awt.SystemTray;
export const TrayIcon = java.awt.TrayIcon;
export const Runtime = java.lang.Runtime;
export const Scanner = java.util.Scanner;
export const Toolkit = java.awt.Toolkit;
export const GLFW = org.lwjgl.glfw.GLFW;
export const System = java.lang.System;
export const Base64 = java.util.Base64;
export const Color = java.awt.Color;
export const File = java.io.File;
export const URL = java.net.URL;

export const BP = net.minecraft.util.math.BlockPos;
export const Vec3d = net.minecraft.util.math.Vec3d;
export const Direction = net.minecraft.util.math.Direction;
export const BlockHitResult = net.minecraft.util.hit.BlockHitResult;
export const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
export const Blocks = net.minecraft.block.Blocks;
export const BlockStone = net.minecraft.block.BlockStone;
export const BlockOre = net.minecraft.block.BlockOre;
export const BlockRedstoneOre = net.minecraft.block.BlockRedstoneOre;
export const SnowBlock = net.minecraft.block.SnowBlock;
export const StainedGlassPaneBlock = net.minecraft.block.StainedGlassPaneBlock;
export const ArmorStandEntity = net.minecraft.entity.decoration.ArmorStandEntity;
export const ZombieEntity = net.minecraft.entity.mob.ZombieEntity;
export const Class709 = net.minecraft.class_709; // pls rename to the correct name idk what it is

export const MinecraftText = net.minecraft.text.Text;
export const Formatting = net.minecraft.util.Formatting;
export const SoundCategory = net.minecraft.sound.SoundCategory;
export const Identifier = net.minecraft.util.Identifier;
export const SoundEvent = net.minecraft.sound.SoundEvent;

export const NVG = Java.type('com.v5.render.NVGRenderer').INSTANCE;
export const RenderUtils = Java.type('com.v5.render.RenderUtils');
export const DiscordRPC = Java.type('com.v5.qol.DiscordRPC');
export const KeyBindUtils = Java.type('com.v5.keybind.KeyBindUtils');
export const XrayPackage = Java.type('com.v5.qol.Xray');
export const GradientChat = Java.type('com.v5.gradient.Chat');
export const ImageIO = Java.type('javax.imageio.ImageIO');
export const BufferedImage = Java.type('java.awt.image.BufferedImage');
export const AlphaComposite = Java.type('java.awt.AlphaComposite');
export const Matrix = UMatrixStack.get();
export const modulesDir = new File('./config/ChatTriggers/modules');
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
