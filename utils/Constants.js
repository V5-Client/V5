export const MCHand = net.minecraft.world.InteractionHand;

export const CLIENT_VERSION = JSON.parse(FileLib.read('V5', 'metadata.json')).version;

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

export const globalAssetsDir = new File('./config/ChatTriggers/assets');

export const BP = net.minecraft.core.BlockPos;
export const Vec3d = net.minecraft.world.phys.Vec3;
export const ClipContext = net.minecraft.world.level.ClipContext;
export const Direction = net.minecraft.core.Direction;
export const BlockHitResult = net.minecraft.world.phys.BlockHitResult;
export const Blocks = net.minecraft.world.level.block.Blocks;
export const SnowBlock = net.minecraft.world.level.block.SnowLayerBlock;
export const ArmorStandEntity = net.minecraft.world.entity.decoration.ArmorStand;
export const ZombieEntity = net.minecraft.world.entity.monster.zombie.Zombie;
export const EndermanEntity = net.minecraft.world.entity.monster.EnderMan;
export const PortalParticle = net.minecraft.client.particle.PortalParticle;
export const CritParticle = net.minecraft.core.particles.ParticleTypes.CRIT;
export const HappyVillagerParticle = net.minecraft.core.particles.ParticleTypes.HAPPY_VILLAGER;

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
