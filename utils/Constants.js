export const MCHand = net.minecraft.world.InteractionHand;

export const CLIENT_VERSION = '1.0.0';

export const StandardCharsets = java.nio.charset.StandardCharsets;
export const BufferedInputStream = java.io.BufferedInputStream;
export const DataFlavor = java.awt.datatransfer.DataFlavor;
export const InputStreamReader = java.io.InputStreamReader;
export const BufferedReader = java.io.BufferedReader;
export const FileOutputStream = java.io.FileOutputStream;
export const ProcessBuilder = java.lang.ProcessBuilder;
export const Files = java.nio.file.Files;
export const StandardCopyOption = java.nio.file.StandardCopyOption;
export const Runtime = java.lang.Runtime;
export const Scanner = java.util.Scanner;
export const Toolkit = java.awt.Toolkit;
export const GLFW = org.lwjgl.glfw.GLFW;
export const System = java.lang.System;
export const Color = java.awt.Color;
export const File = java.io.File;
export const URL = java.net.URL;

const os = System.getProperty('os.name').toLowerCase();
export const isWindows = os.includes('win');
export const isLinux = os.includes('nux') || os.includes('nix');
export const isMac = os.includes('mac');

export const globalAssetsDir = new File('./config/ChatTriggers/assets');

export const BP = net.minecraft.core.BlockPos;
export const Vec3d = net.minecraft.world.phys.Vec3;
export const Direction = net.minecraft.core.Direction;
export const BlockHitResult = net.minecraft.world.phys.BlockHitResult;
export const Blocks = net.minecraft.world.level.block.Blocks;
export const SnowBlock = net.minecraft.world.level.block.SnowLayerBlock;
export const ArmorStandEntity = net.minecraft.world.entity.decoration.ArmorStand;
export const ZombieEntity = net.minecraft.world.entity.monster.zombie.Zombie;
export const PortalParticle = net.minecraft.client.particle.PortalParticle;

export const SoundCategory = net.minecraft.sounds.SoundSource;
export const Identifier = net.minecraft.resources.Identifier;
export const SoundEvent = net.minecraft.sounds.SoundEvent;
export const Consumer = java.util.function.Consumer;
export const ScreenshotRecorder = net.minecraft.client.Screenshot;

export const V5ConfigFile = new File('./config/ChatTriggers/modules/V5Config/config.json');
export const Links = {
    WEBSOCKET_URL: 'wss://backend.rdbt.top/api/chat',
    BASE_API_URL: 'https://backend.rdbt.top',
    PATHFINDER_API_URL: 'http://localhost:3000',
};
