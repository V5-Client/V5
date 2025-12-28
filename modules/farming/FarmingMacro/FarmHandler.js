import { MathUtils } from '../../../utils/Math';

export default class FarmHandler {
    constructor(parent) {
        this.parent = parent;
    }

    onTick() {
        throw new Error('onTick() must be implemented in the specific crop class!');
    }

    scan3x3x3() {
        const playerBlockX = Math.floor(Player.getPlayer().getX());
        const playerBlockY = Math.round(Player.getPlayer().getY());
        const playerBlockZ = Math.floor(Player.getPlayer().getZ());

        const scanResults = [];
        const xzOffsets = [-1, 0, 1];
        const yOffsets = [0, 1, 2];

        for (const yOffset of yOffsets) {
            const scanY = playerBlockY + yOffset;
            for (const xOffset of xzOffsets) {
                const scanX = playerBlockX + xOffset;
                for (const zOffset of xzOffsets) {
                    const scanZ = playerBlockZ + zOffset;
                    const block = World.getBlockAt(scanX, scanY, scanZ);
                    scanResults.push({
                        x: scanX,
                        y: scanY,
                        z: scanZ,
                        name: block?.type?.getRegistryName(),
                    });
                }
            }
        }
        return scanResults;
    }

    scanSides() {
        const player = Player.getPlayer();
        const playerBlockX = Math.floor(player.getX());
        const playerBlockY = Math.round(player.getY());
        const playerBlockZ = Math.floor(player.getZ());

        let yaw = ((player.getYaw() % 360) + 360) % 360;
        const scanResults = [];
        const range = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

        let dx = 0,
            dz = 0;
        if (yaw >= 315 || yaw < 45) dx = -1; // SOUTH
        else if (yaw >= 45 && yaw < 135) dz = -1; // WEST
        else if (yaw >= 135 && yaw < 225) dx = 1; // NORTH
        else if (yaw >= 225 && yaw < 315) dz = 1; // EAST

        for (const offset of range) {
            let scanX = playerBlockX + dx * offset;
            let scanZ = playerBlockZ + dz * offset;
            const block = World.getBlockAt(scanX, playerBlockY, scanZ);

            scanResults.push({
                x: scanX,
                y: playerBlockY,
                z: scanZ,
                name: block?.type?.getRegistryName(),
                offset: offset,
            });
        }
        return scanResults;
    }

    getBlockInFront(offsetDist = 1, yOffset = 0) {
        const player = Player.getPlayer();
        let yaw = ((player.getYaw() % 360) + 360) % 360;
        let dx = 0,
            dz = 0;

        if (yaw >= 315 || yaw < 45) dz = 1;
        else if (yaw >= 45 && yaw < 135) dx = -1;
        else if (yaw >= 135 && yaw < 225) dz = -1;
        else if (yaw >= 225 && yaw < 315) dx = 1;

        const targetX = Math.floor(player.getX() + dx * offsetDist);
        const targetY = Math.round(player.getY() + yOffset);
        const targetZ = Math.floor(player.getZ() + dz * offsetDist);

        const block = World.getBlockAt(targetX, targetY, targetZ);
        if (!block) return null;

        return {
            x: targetX + 0.5,
            y: targetY,
            z: targetZ + 0.5,
            name: block.type.getRegistryName(),
            id: block.type.getID(),
        };
    }

    checkForCrop(checkForAge = true, yOffset = 1) {
        const p = Player.getPlayer();
        let yaw = ((p.getYaw() % 360) + 360) % 360;

        let fx = 0,
            fz = 0; // Forward
        let sx = 0,
            sz = 0; // Side (Right)

        if (yaw >= 315 || yaw < 45) {
            fz = 1;
            sx = -1;
        } else if (yaw >= 45 && yaw < 135) {
            fx = -1;
            sz = -1;
        } else if (yaw >= 135 && yaw < 225) {
            fz = -1;
            sx = 1;
        } else if (yaw >= 225 && yaw < 315) {
            fx = 1;
            sz = 1;
        }

        const getInfo = (offX, offZ) => {
            const targetX = Math.floor(p.getX() + offX);
            const targetY = Math.round(p.getY()) + yOffset;
            const targetZ = Math.floor(p.getZ() + offZ);

            const pos = new net.minecraft.util.math.BlockPos(targetX, targetY, targetZ);
            const state = World.getWorld().getBlockState(pos);
            const block = state.getBlock();
            const CTBlock = World.getBlockAt(targetX, targetY, targetZ);

            if (checkForAge) {
                const ageProp = block.getStateManager().getProperty('age');
                return { age: ageProp ? state.get(ageProp) : -1 };
            }

            const blockName = CTBlock?.type?.getRegistryName() || '';
            const isInvalid = blockName.includes('air') || blockName.includes('water') || blockName.includes('dirt');
            return { exists: isInvalid ? 0 : 1 };
        };

        return {
            right: getInfo(fx + sx, fz + sz),
            left: getInfo(fx - sx, fz - sz),
        };
    }

    getSidesDistance() {
        let sides = this.scanSides();
        let maxDistLeft = 0;
        let maxDistRight = 0;

        sides.forEach((block) => {
            let distance = Math.abs(block.offset);
            if (block.name && !block.name.includes('air') && !block.name.includes('water')) {
                if (block.offset < 0 && distance > maxDistLeft) maxDistLeft = distance;
                else if (block.offset > 0 && distance > maxDistRight) maxDistRight = distance;
            }
        });
        return { maxDistLeft, maxDistRight };
    }

    isAtPoint(x, y, z, minDist = 1) {
        let check = MathUtils.getDistanceToPlayer(x, y, z).distance;
        return check < minDist;
    }

    areChunksLoaded(x, z) {
        const chunkX = Math.floor(x) >> 4;
        const chunkZ = Math.floor(z) >> 4;
        return World.getWorld().getChunkManager().isChunkLoaded(chunkX, chunkZ);
    }

    getAngle(point) {
        return MathUtils.calculateAbsoluteAngles([point.x, point.y, point.z]).yaw;
    }

    getRegistry(point) {
        if (!point) return null;
        return World.getBlockAt(point.x, point.y, point.z)?.type?.getRegistryName();
    }

    handleRewarp() {
        const p = this.parent;

        if (!p.warpDelay) {
            const randomDelay = Math.floor(Math.random() * 251) + 500;
            p.warpDelay = Date.now() + randomDelay;
            p.message(`&7Warping in ${randomDelay}ms...`, true);
            return;
        }

        if (Date.now() >= p.warpDelay) ChatLib.command('warp garden');

        if (this.isAtPoint(p.points.start.x, p.points.start.y, p.points.start.z, 1)) {
            if (this.areChunksLoaded(p.points.start.x, p.points.start.z)) {
                p.warpDelay = null;
                p.state = p.STATES.SCANFORCROP;
            } else {
                p.message('Waiting for chunks to load', true);
            }
        }
    }
}
