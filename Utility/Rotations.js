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
    this.yawOnly = false;

    register("postRenderWorld", () => {
      if (!this.rotating) return;

      let player = Player.getPlayer();
      let currentYaw = player.getYaw();
      let currentPitch = player.getPitch();

      if (this.targetVector) {
        let playerPos = player.getPos();
        let eyeHeight = player.getEyePos();

        let dx = this.targetVector.x - playerPos.x;
        let dy = this.targetVector.y - (playerPos.y + eyeHeight);
        let dz = this.targetVector.z - playerPos.z;

        this.targetYaw = yaw;
        if (this.yawOnly) {
          this.targetPitch = this.targetPitch ?? player.getPitch();
        } else {
          this.targetPitch = pitch;
        }
      }

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
}

export const Rotations = new RotationsTo();
