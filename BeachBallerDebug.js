// WARNING: VIBECODED CUZ I CBA DOING THIS, BUT IT WORKS
// FIND LARGE BEACHBALL PLEASE. IT WONT WORK FOR ME IDK WHY.

import { Chat } from './Utility/Chat';

register('command', () => {
    Chat.message('&a&l[DEBUG] &rScanning for armor stands...');

    const stands = World.getAllEntitiesOfType(net.minecraft.entity.decoration.ArmorStandEntity.class);
    const playerPos = [Player.getX(), Player.getY(), Player.getZ()];

    let foundCount = 0;

    stands.forEach((stand, index) => {
        const standPos = [stand.getX(), stand.getY(), stand.getZ()];
        const distance = Math.sqrt(Math.pow(playerPos[0] - standPos[0], 2) + Math.pow(playerPos[1] - standPos[1], 2) + Math.pow(playerPos[2] - standPos[2], 2));

        // Only check nearby stands (within 10 blocks)
        if (distance > 10) return;

        const headItem = stand.getStackInSlot(5); // Helmet slot
        if (!headItem) return;

        foundCount++;

        Chat.message('&e&l━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Chat.message(`&b&lArmor Stand #${foundCount} &r(${distance.toFixed(2)} blocks away)`);
        Chat.message(`&7Position: ${stand.getX().toFixed(1)}, ${stand.getY().toFixed(1)}, ${stand.getZ().toFixed(1)}`);

        // Get item name
        const itemName = headItem.getName();
        Chat.message(`&aItem Name: &f${itemName}`);

        // Get NBT data
        const nbt = headItem.getNBT();
        const nbtString = nbt.toString();

        // Log the full NBT data to the console for inspection
        console.log(`--- FULL NBT for Armor Stand #${foundCount} ---`);
        console.log(nbtString);
        Chat.message('&aFull NBT for this stand printed to console.');

        // Try to extract texture hash from NBT
        const textureMatches = nbtString.match(/texture[s]?[\/:]([a-f0-9]{64})/gi);
        if (textureMatches) {
            Chat.message('&6Found Texture Hashes:');
            textureMatches.forEach((match) => {
                const hash = match.match(/([a-f0-9]{64})/i);
                if (hash) {
                    Chat.message(`&e  → &f${hash[1]}`);
                }
            });
        }

        // Try to find and decode base64 texture data
        const base64Match = nbtString.match(/Value:\s*"([A-Za-z0-9+\/=]{100,})"/);
        if (base64Match) {
            try {
                const base64 = base64Match[1];
                const decoded = java.lang.String(java.util.Base64.getDecoder().decode(base64));
                Chat.message('&dDecoded Texture Data:');
                Chat.message(`&f${decoded}`);

                // Extract hash from decoded JSON
                const urlMatch = decoded.match(/texture\/([a-f0-9]{64})/i);
                if (urlMatch) {
                    const extractedHash = urlMatch[1];
                    Chat.message('&6&lExtracted Hash: &f' + extractedHash);

                    // --- NEW ---
                    // Log the hash separately to the console for easy copying
                    console.log('--- HASH FOR COPYING ---');
                    console.log(extractedHash);
                    Chat.message('&bHash also printed to console for easy copying!');
                }
            } catch (e) {
                Chat.message('&cFailed to decode base64: ' + e);
            }
        }

        // Store NBT for later viewing
        global.beachballDebugNBT = global.beachballDebugNBT || {};
        global.beachballDebugNBT[index] = nbtString;
    });

    if (foundCount === 0) {
        Chat.message('&c&l[DEBUG] &rNo armor stands with helmets found within 10 blocks!');
        Chat.message('&7Try standing closer to a beach ball');
    } else {
        Chat.message('&e&l━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Chat.message('&a&l[DEBUG] &rFound ' + foundCount + ' armor stand(s) with items!');
    }
}).setName('findbeachball');

// Command to copy hash to clipboard
register('command', (hash) => {
    if (!hash) return;

    // Copy to clipboard using Java
    const stringSelection = new java.awt.datatransfer.StringSelection(hash);
    const clipboard = java.awt.Toolkit.getDefaultToolkit().getSystemClipboard();
    clipboard.setContents(stringSelection, null);

    Chat.message(`&a&lCopied to clipboard: &f${hash}`);
}).setName('beachballcopyhash');

// Command to show full NBT
register('command', (index) => {
    if (!global.beachballDebugNBT || !global.beachballDebugNBT[index]) {
        Chat.message('&cNo NBT data found for that index');
        return;
    }

    console.log('=== FULL NBT DATA ===');
    console.log(global.beachballDebugNBT[index]);
    Chat.message('&aFull NBT printed to console (press T and scroll up, or check logs)');
}).setName('beachballshownbt');

Chat.message('&a&l[Beach Ball Debugger Loaded]');
Chat.message('&7Use &f/findbeachball &7while near a beach ball to find its texture hash!');
