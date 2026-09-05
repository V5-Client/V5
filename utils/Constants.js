export const MCHand = net.minecraft.world.InteractionHand;

export const CLIENT_VERSION = JSON.parse(FileLib.read('V5', 'metadata.json')).version;

export const StandardCharsets = java.nio.charset.StandardCharsets;
export const BufferedInputStream = java.io.BufferedInputStream;
export const DataFlavor = java.awt.datatransfer.DataFlavor;
export const InputStreamReader = java.io.InputStreamReader;
export const BufferedReader = java.io.BufferedReader;
export const FileInputStream = java.io.FileInputStream;
export const FileOutputStream = java.io.FileOutputStream;
export const OutputStreamWriter = java.io.OutputStreamWriter;
export const ProcessBuilder = java.lang.ProcessBuilder;
export const Files = java.nio.file.Files;
export const StandardCopyOption = java.nio.file.StandardCopyOption;
export const Runtime = java.lang.Runtime;
export const Scanner = java.util.Scanner;
export const Toolkit = java.awt.Toolkit;
export const AudioSystem = javax.sound.sampled.AudioSystem;
export const FloatControl = javax.sound.sampled.FloatControl;
export const BufferUtils = org.lwjgl.BufferUtils;
export const GLFW = org.lwjgl.glfw.GLFW;
export const System = java.lang.System;
export const SystemTray = java.awt.SystemTray;
export const TrayIcon = java.awt.TrayIcon;
export const Arrays = java.util.Arrays;
export const AtomicInteger = java.util.concurrent.atomic.AtomicInteger;
export const Executors = java.util.concurrent.Executors;
export const JavaArray = java.lang.reflect.Array;
export const JavaByte = java.lang.Byte;
export const JavaInteger = java.lang.Integer;
export const JavaLong = java.lang.Long;
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
export const ShulkerEntity = net.minecraft.world.entity.monster.Shulker;
export const PortalParticle = net.minecraft.client.particle.PortalParticle;
export const ParticleTypes = net.minecraft.core.particles.ParticleTypes;
export const DataComponents = net.minecraft.core.component.DataComponents;
export const InputConstants = com.mojang.blaze3d.platform.InputConstants;
export const SkijaPIP = Java.type('com.chattriggers.ctjs.api.render.skia.SkijaPIP');
export const CritParticle = ParticleTypes.CRIT;
export const HappyVillagerParticle = ParticleTypes.HAPPY_VILLAGER;

export const SoundCategory = net.minecraft.sounds.SoundSource;
export const Identifier = net.minecraft.resources.Identifier;
export const SoundEvent = net.minecraft.sounds.SoundEvent;
export const Consumer = Java.type('java.util.function.Consumer');
export const ScreenshotRecorder = net.minecraft.client.Screenshot;

export const V5ConfigFile = new File('./config/ChatTriggers/modules/V5Config/config.json');
export const Links = {
    WEBSOCKET_URL: 'wss://backend.rdbt.top/api/chat',
    BASE_API_URL: 'https://backend.rdbt.top',
    PATHFINDER_API_URL: 'http://localhost:3000',
};
