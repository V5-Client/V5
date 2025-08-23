import { MathUtils  } from "./Math"
const BP = net.minecraft.util.math.BlockPos
const Vec3 = net.minecraft.util.math.Vec3d
const Direction = net.minecraft.util.math.Direction
const PlayerActionC2SPacket = net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
const PlayerActionC2SPacketAction = net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket$Action
const HandSwingC2SPacket = net.minecraft.network.packet.c2s.play.HandSwingC2SPacket

class NukerUtilsClass {
  constructor() {
    this.lastNukeTime = Date.now()

    this.nukeQueue = []
    this.tickCounter = 0
    this.delay = 0
    this.fakelookMode = "Queue"
    this.sequence = 1

    register("packetSent", (packet) => {
      if (packet.getSequence() != 0) this.sequence = packet.getSequence() + 1
    }).setFilteredClass(PlayerActionC2SPacket)

    register("tick", () => {
      if (this.fakelookMode === "Queue") {
        if (this.nukeQueue.length > 0) {
          nextAction = this.nukeQueue.pop()
          blockCoords = nextAction[0]
          ticksToWait = nextAction[1]
          this.nukeQueue = []

          const blockPos = new BP(Math.floor(blockCoords[0]), Math.floor(blockCoords[1]), Math.floor(blockCoords[2]))
          if (MathUtils.getDistanceToPlayerEyes(blockCoords[0], blockCoords[1], blockCoords[2]).distance > 5) return 
          const facing = this.closestDirection(blockPos)
          
          Client.sendPacket(new PlayerActionC2SPacket(PlayerActionC2SPacketAction.START_DESTROY_BLOCK, blockPos, facing, this.sequence))
          Client.sendPacket(new HandSwingC2SPacket(Hand.MAIN_HAND))

          this.tickCounter = ticksToWait
          return
        }

        if (this.tickCounter > 0) {
          this.tickCounter--
          Client.sendPacket(new HandSwingC2SPacket(Hand.MAIN_HAND))
          return
        }
      }
    })
  }

  nukeQueueAdd(blockPos, ticks) {
    this.nukeQueue.push([blockPos, ticks])
  }

  closestDirection(blockPos) {
    const playerEyePos = Player.getPlayer().getEyePos();

    let minDistance = Infinity;
    let closestFace = Direction.UP;

    const faces = [Direction.UP, Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST];

    faces.forEach(face => {
      let offsetX = 0;
      let offsetY = 0;
      let offsetZ = 0;

      switch (face) {
        case Direction.DOWN:
          offsetY = -1;
          break;
        case Direction.UP:
          offsetY = 1;
          break;
        case Direction.NORTH:
          offsetZ = -1;
          break;
        case Direction.SOUTH:
          offsetZ = 1;
          break;
        case Direction.WEST:
          offsetX = -1;
          break;
        case Direction.EAST:
          offsetX = 1;
          break;
      }

      const faceVec = new Vec3(
        blockPos.getX() + 0.5 + offsetX * 0.5,
        blockPos.getY() + 0.5 + offsetY * 0.5,
        blockPos.getZ() + 0.5 + offsetZ * 0.5,
      );
      const distance = playerEyePos.distanceTo(faceVec);

      if (distance < minDistance) {
        minDistance = distance;
        closestFace = face;
      }
    });

    return closestFace;
  }

  nuke(blockPos, ticks = 1) {
    if (MathUtils.getDistanceToPlayerEyes(blockPos[0], blockPos[1], blockPos[2]).distance > 5) return
    if (Date.now() - this.lastNukeTime > 50 + ticks * 50 || ticks === 1 || this.delay >= 50) {
      if (this.delay > 50) Client.scheduleTask(1, () => MiningBot.ticksMined--)
      this.delay = 0
    }

    this.lastNukeTime = Date.now()
    this.tickCounter = ticks

    setTimeout(() => {
      const bp = new BP(Math.floor(blockPos[0]), Math.floor(blockPos[1]), Math.floor(blockPos[2]))
      const facing = this.closestDirection(bp)
      Client.sendPacket(
        new PlayerActionC2SPacket(
          PlayerActionC2SPacketAction.START_DESTROY_BLOCK,
          bp,
          facing,
          this.sequence
        ),
      )
      this.currentBreakingBlockPos = blockPos
    }, this.delay)

    this.delay += 10
  }
}

export const NukerUtils = new NukerUtilsClass()
