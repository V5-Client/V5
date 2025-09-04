import { RayTrace } from './Utility/Raytrace';
import { Chat } from './Utility/Chat';
import { getPlayerEyeCoords } from './Dependencies/BloomCore/RaytraceBlocks';
/**
 * Reliably finds a Minecraft class using Java Reflection, bypassing class loader issues.
 * @param {string} name - The fully qualified name of the class (e.g., "net.minecraft.world.phys.ClipContext")
 * @returns {JavaClass} The loaded Java class.
 */
function findClass(name) {
    return java.lang.Class.forName(
        name,
        true,
        Player.getPlayer().getClass().getClassLoader()
    );
}

// Register command to check visibility of the block you're looking at
register('command', () => {
    const lookingAt = RayTrace.raytrace(6); // Get block within 6 blocks

    if (!lookingAt) {
        Chat.message('&cNo block found in range!');
        return;
    }

    const blockPos = new BlockPos(553, 89, 236);
    const eyeCoords = getPlayerEyeCoords();
    const eyePos = { x: eyeCoords[0], y: eyeCoords[1], z: eyeCoords[2] };

    // Test with native raycast (fast)
    const visibleNative = RayTrace.isBlockVisible(blockPos, null, true);

    // Test with JS raycast (slower but more customizable)
    const visibleJS = RayTrace.isBlockVisible(blockPos, null, false);

    // Get visible point if any
    const visiblePoint = RayTrace.getPointOnBlock(blockPos, null, false);

    // Format output
    Chat.message(`&e===== Block Visibility Test =====`);
    Chat.message(
        `&7Block: &f${World.getBlockAt(
            blockPos.x,
            blockPos.y,
            blockPos.z
        )?.type?.getRegistryName()} &7at &f[${blockPos.x}, ${blockPos.y}, ${
            blockPos.z
        }]`
    );
    Chat.message(
        `&7Distance: &f${Math.sqrt(
            Math.pow(blockPos.x + 0.5 - eyePos.x, 2) +
                Math.pow(blockPos.y + 0.5 - eyePos.y, 2) +
                Math.pow(blockPos.z + 0.5 - eyePos.z, 2)
        ).toFixed(2)} blocks`
    );
    Chat.message(`&7Visible (Native): ${visibleNative ? '&a✓ Yes' : '&c✗ No'}`);
    Chat.message(`&7Visible (JS): ${visibleJS ? '&a✓ Yes' : '&c✗ No'}`);

    if (visiblePoint) {
        Chat.message(
            `&7Visible Point: &f[${visiblePoint.map((v) => v.toFixed(2)).join(', ')}]`
        );
    } else {
        Chat.message(`&7Visible Point: &cNone found`);
    }

    Chat.message(`&e================================`);
})
    .setName('checkblockvisibility')
    .setAliases('cbv');

// Auto-check mode - continuously check the block you're looking at
let autoCheckEnabled = false;
let lastCheckedBlock = null;

register('command', () => {
    autoCheckEnabled = !autoCheckEnabled;
    Chat.message(
        `&7Auto-check mode: ${autoCheckEnabled ? '&aEnabled' : '&cDisabled'}`
    );

    if (!autoCheckEnabled) {
        lastCheckedBlock = null;
    }
})
    .setName('autocheckvisibility')
    .setAliases('acv');

register('tick', () => {
    if (!autoCheckEnabled) return;

    const lookingAt = RayTrace.raytrace(6);
    if (!lookingAt) {
        lastCheckedBlock = null;
        return;
    }

    const blockPos = lookingAt.getPos();
    const blockKey = `${blockPos.x},${blockPos.y},${blockPos.z}`;

    // Only check if we're looking at a different block
    if (lastCheckedBlock === blockKey) return;
    lastCheckedBlock = blockKey;

    const visible = RayTrace.isBlockVisible(blockPos);
    const blockName = lookingAt.type.getName();

    Chat.message(
        `&7[${blockPos.x}, ${blockPos.y}, ${blockPos.z}] &f${blockName}: ${
            visible ? '&aVisible' : '&cNot Visible'
        }`
    );
});

//Chat.message("&aBlock Visibility Debug loaded!");
//Chat.message("&7Commands:");
//Chat.message(
//  "&7 - &f/checkblockvisibility &7(or &f/cbv&7) - Check current block"
//);
//Chat.message(
//  "&7 - &f/autocheckvisibility &7(or &f/acv&7) - Toggle auto-check mode"
//);

// HOLY SHIT THAT MESSAGE GOT ANNOYING
