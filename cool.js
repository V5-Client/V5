const mc = Client.getMinecraft();
const Blocks = net.minecraft.block.Blocks
const Runnable = java.lang.Runnable

// Helper function to create a thread that finds stone blocks and passes positions back
function createWorkerThread(
  startX,
  endX,
  startZ,
  endZ,
  playerPos,
  collectedPositions
) {
  return new Thread(
    new Runnable({
      run: () => {
        const world = mc.world;
        for (let x = startX; x <= endX; x++) {
          for (let z = startZ; z <= endZ; z++) {
            for (let y = 0; y < world.getHeight(); y++) {
              let pos = playerPos.add(x, y - playerPos.getY(), z);
              let blockState = world.getBlockState(pos);
              if (blockState.getBlock() == Blocks.STONE) {
                // Collect positions to update later on the main thread
                collectedPositions.push(pos);
              }
            }
          }
        }
      },
    })
  );
}

let threadResults = [];
let threadsStarted = false;

register("tick", () => {
  const client = mc;
  const world = client.world;
  if (!world || !client.player) return;

  const playerPos = client.player.getBlockPos();
  const renderDistance = mc.options.getViewDistance().getValue(); // in chunks
  const radius = renderDistance * 16;

  if (!threadsStarted) {
    const numThreads = 4; // You can adjust this
    const collectedPositions = [];

    // Divide the XZ plane into quadrants or stripes
    const sectionSize = Math.floor((radius * 2 + 1) / numThreads);
    let threads = [];

    for (let i = 0; i < numThreads; i++) {
      let startX = -radius + i * sectionSize;
      let endX = i === numThreads - 1 ? radius : startX + sectionSize - 1;
      threads.push(
        createWorkerThread(
          startX,
          endX,
          -radius,
          radius,
          playerPos,
          collectedPositions
        )
      );
    }

    threads.forEach((thread) => thread.start());

    threadResults = [threads, collectedPositions];
    threadsStarted = true;
  } else {
    // Check if all threads are done
    const [threads, collectedPositions] = threadResults;
    if (threads.every((thread) => !thread.isAlive())) {
      // All threads done, now update world blocks (client-side)
      const world = mc.world;
      collectedPositions.forEach((pos) => {
        world.setBlockState(pos, Blocks.AIR.getDefaultState()); // Client-side visual change
      });

      // Reset for next tick
      threadsStarted = false;
      threadResults = [];
    }
  }
});
