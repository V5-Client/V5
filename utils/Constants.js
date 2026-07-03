export const SharedConstants = net.minecraft.SharedConstants;
export const MinecraftClient = net.minecraft.client.Minecraft;
export const MCHand = net.minecraft.world.InteractionHand;

export const CLIENT_VERSION = '1.0.0';

export const UMatrixStack = Java.type('gg.essential.universal.UMatrixStack').Compat.INSTANCE;
export const ConcurrentLinkedQueue = java.util.concurrent.ConcurrentLinkedQueue;
export const AtomicBoolean = java.util.concurrent.atomic.AtomicBoolean;
export const StandardCharsets = java.nio.charset.StandardCharsets;
export const BufferedInputStream = java.io.BufferedInputStream;
export const DataFlavor = java.awt.datatransfer.DataFlavor;
export const InputStreamReader = java.io.InputStreamReader;
export const BufferedReader = java.io.BufferedReader;
export const FileWriter = java.io.FileWriter;
export const FileOutputStream = java.io.FileOutputStream;
export const FileInputStream = java.io.FileInputStream;
export const DataOutputStream = java.io.DataOutputStream;
export const MessageType = java.awt.TrayIcon.MessageType;
export const ProcessBuilder = java.lang.ProcessBuilder;
export const TimeUnit = java.util.concurrent.TimeUnit;
export const Files = java.nio.file.Files;
export const StandardCopyOption = java.nio.file.StandardCopyOption;
export const ArrayLists = java.util.ArrayList;
export const SystemTray = java.awt.SystemTray;
export const TrayIcon = java.awt.TrayIcon;
export const Runtime = java.lang.Runtime;
export const Scanner = java.util.Scanner;
export const Toolkit = java.awt.Toolkit;
export const GLFW = org.lwjgl.glfw.GLFW;
export const Desktop = java.awt.Desktop;
export const System = java.lang.System;
export const Base64 = java.util.Base64;
export const Color = java.awt.Color;
export const File = java.io.File;
export const URL = java.net.URL;

export const OS = System.getProperty('os.name').toLowerCase();
export const isWindows = OS.includes('win');
export const isMac = OS.includes('mac');
export const isLinux = OS.includes('nux') || OS.includes('nix');

export const globalAssetsDir = new File('./config/ChatTriggers/assets');

export const FFMPEG_URLS = {
    WIN_ZIP: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    LINUX_TAR_XZ: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
    MAC_BINARY: 'https://evermeet.cx/ffmpeg/ffmpeg-8.0.1',
};

export const BP = net.minecraft.core.BlockPos;
export const Vec3d = net.minecraft.world.phys.Vec3;
export const Direction = net.minecraft.core.Direction;
export const BlockHitResult = net.minecraft.world.phys.BlockHitResult;
export const VoxelShapes = net.minecraft.world.phys.shapes.Shapes;
export const Blocks = net.minecraft.world.level.block.Blocks;
export const SnowBlock = net.minecraft.world.level.block.SnowLayerBlock;
export const StainedGlassPaneBlock = net.minecraft.world.level.block.StainedGlassPaneBlock;
export const ArmorStandEntity = net.minecraft.world.entity.decoration.ArmorStand;
export const ZombieEntity = net.minecraft.world.entity.monster.zombie.Zombie;
export const EndermanEntity = net.minecraft.world.entity.monster.EnderMan;
export const BatEntity = net.minecraft.world.entity.ambient.Bat;
export const PortalParticle = net.minecraft.client.particle.PortalParticle; // pls rename to the correct name idk what it is

export const MinecraftText = net.minecraft.network.chat.Component;
export const Formatting = net.minecraft.ChatFormatting;
export const SoundCategory = net.minecraft.sounds.SoundSource;
export const Identifier = net.minecraft.resources.Identifier;
export const SoundEvent = net.minecraft.sounds.SoundEvent;
export const NativeImage = com.mojang.blaze3d.platform.NativeImage;
export const Transferable = java.awt.datatransfer.Transferable;
export const Consumer = java.util.function.Consumer;
export const ScreenshotRecorder = net.minecraft.client.Screenshot;

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
