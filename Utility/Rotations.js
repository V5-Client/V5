import { Vector } from "./DataClasses/Vec";
import { Utils } from "./Utils";

/**
 *TODO -> Probably Recode 💀
 *
 * Settings:
 *  Speed       : rotation speed multiplier (0.06 default) (60)
 *  Randomness  : max jitter offset in degrees (0.05 default) (5)
 *  TremorFreq  : jitter updates per second (1 default) ()
 *  Fade        : how jitter fades near the target (exponent, 1 default)
 */
class RotationsTo {
  constructor() {
    this.targetYaw = null;
    this.targetPitch = null;
    this.rotating = false;

    this.Speed = 0.06; // speed of rotation per tick
    this.tremorFrequency = 1; // jitter updates per second
    this.fadeExponent = 0.05; // controls jitter fade
    this.Randomness = 0.005; // max random offset (degrees)

    this.currentRandomYaw = 0;
    this.currentRandomPitch = 0;
    this.lastTremorTime = 0;

    this.targetVector = null;
    this.precision = 1.0;

    this.actions = [];

    register("postRenderWorld", () => {
      if (!this.rotating) return;

      let player = Player.getPlayer();
      if (!player) return;

      let currentYaw = player.getYaw();
      let currentPitch = player.getPitch();

      if (this.targetVector) {
        let playerPos = player.getPos();
        let eyeHeight = player.getEyePos().y - playerPos.y; // relative eye height

        let dx = this.targetVector.x - playerPos.x;
        let dy = this.targetVector.y - (playerPos.y + eyeHeight);
        let dz = this.targetVector.z - playerPos.z;

        // Calculate yaw in degrees
        this.targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        let dist = Math.sqrt(dx * dx + dz * dz);
        this.targetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);
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

        this.actions.forEach((action) => {
          try {
            action();
          } catch (e) {
            console.error("Rotation callback error:", e);
          }
        });

        this.actions = [];

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

  rotateTo(vector) {
    let vec = Utils.convertToVector(vector);
    this.rotating = true;
    this.targetVector = new Vector(vec.x + 0.5, vec.y + 0.5, vec.z + 0.5);
  }

  onEndRotation(callBack) {
    this.actions.push(callBack);
  }

  stopRotation() {
    this.targetVector = null;
    this.rotate = false;
  }

  getPlayerRotation() {
    const player = Player.getPlayer();
    if (!player) return null;
    return { yaw: player.getYaw(), pitch: player.getPitch() };
  }

  getRotationTo(toPos) {
    const player = Player.getPlayer();
    if (!player) return null;
    return this.getRotation(player.getEyePos(), toPos);
  }
}

export const Rotations = new RotationsTo();
