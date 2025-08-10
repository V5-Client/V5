import { Vector } from "./DataClasses/Vec";
import { Utils } from "./Utils";

/** Setting calculations
 * Speed : (x / 1000) / 2
 * Randomness : (x / 1000) / 2
 * Tremor : x = x
 * Fade : x = x
 */

/** TODO
 * RotateTo a vector
 * Update target (not sure)
 */

class RotationsTo {
  constructor() {
    this.targetYaw = null;
    this.targetPitch = null;
    this.rotating = false;

    this.Speed = 0.02; // speed of rotation
    this.tremorFrequency = 1; // jitter updates per second
    this.fadeExponent = 1; // controls how jitter fades near target
    this.Randomness = 0.05; // max random offset in degrees

    this.currentRandomYaw = 0;
    this.currentRandomPitch = 0;
    this.lastTremorTime = 0;

    this.targetVector = null;
    this.precision = 1.0;
    this.smoothing = 0.3;
    this.yawOnly = false;

    register("command", (x, y, z) => {
      Rotations.rotateToTarget(x, y, z);
    }).setName("rotatetarget");

    register("command", (yaw, pitch) => {
      Rotations.rotateToAngles(yaw, pitch);
    }).setName("rotatetoangle");

    register("postRenderWorld", () => {
      if (!this.rotating) return;

      if (this.targetVector != null) {
        const player = Player.getPlayer();
        const rot = Utils.getRotationTo(this.targetVector);
        const from = Utils.getPlayerRotation();
        const neededChange = Utils.getNeededChange(from, rot);
        const to = {
          yaw: from.yaw + neededChange.yaw,
          pitch: from.pitch + neededChange.pitch,
        };

        if (!Utils.shouldRotate(from, to, this.precision)) {
          return;
        }

        let needYaw = to.yaw - from.yaw;
        let needPitch = to.pitch - from.pitch;
        const distance = Math.abs(needYaw) + Math.abs(needPitch);

        needYaw *= this.smoothing + Math.random() * this.smoothing;
        needPitch *= this.smoothing + Math.random() * this.smoothing;

        const scaledFps = 60 / Client.getFPS();

        needYaw *= scaledFps;
        needPitch *= scaledFps;
        needYaw /= Math.max(distance / 80, 1);
        player.setYaw(player.getYaw() + needYaw);

        const newPitch = player.getPitch() + needPitch;

        if (
          (newPitch > 75 && needPitch < 0) ||
          (newPitch < -75 && needPitch > 0) ||
          (newPitch > -75 && newPitch < 75)
        ) {
          player.setPitch(newPitch);
        }

        return;
      }

      let player = Player.getPlayer();
      let currentYaw = player.getYaw();
      let currentPitch = player.getPitch();

      let yawDiff = this.wrapDegrees(this.targetYaw - currentYaw);
      let pitchDiff = this.wrapDegrees(this.targetPitch - currentPitch);

      if (
        Math.abs(yawDiff) < this.precision &&
        Math.abs(pitchDiff) < this.precision
      ) {
        player.setYaw(this.targetYaw);
        player.setPitch(this.targetPitch);
        this.rotating = false;
        return;
      }

      let maxDiff = Math.max(Math.abs(yawDiff), Math.abs(pitchDiff));
      let normalizedDist = Math.min(maxDiff / 180, 1);

      let now = Date.now();
      if (now - this.lastTremorTime > 1000 / this.tremorFrequency) {
        this.currentRandomYaw = (Math.random() - 0.5) * this.Randomness;
        this.currentRandomPitch = (Math.random() - 0.5) * this.Randomness;
        this.lastTremorTime = now;
      }

      let fadeFactor = Math.pow(normalizedDist, this.fadeExponent);

      let jitterYaw = this.currentRandomYaw * fadeFactor;
      let jitterPitch = this.currentRandomPitch * fadeFactor;

      let newYaw = currentYaw + yawDiff * this.Speed + jitterYaw;
      let newPitch = currentPitch + pitchDiff * this.Speed + jitterPitch;

      player.setYaw(newYaw);
      player.setPitch(newPitch);
    });
  }

  wrapDegrees(degrees) {
    degrees = degrees % 360;
    if (degrees >= 180) degrees -= 360;
    if (degrees < -180) degrees += 360;
    return degrees;
  }

  rotateToAngles(yaw, pitch) {
    this.targetYaw = yaw;
    this.targetPitch = pitch;
    this.targetVector = null;
    this.rotating = true;
  }

  rotateToTarget(x, y, z) {
    this.targetVector = new Vector(x, y, z);
    this.rotating = true;
  }

  stop() {
    this.rotating = false;
  }
}

export const Rotations = new RotationsTo();
