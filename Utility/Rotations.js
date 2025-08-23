import { Vector } from "./DataClasses/Vec";
import { Utils } from "./Utils";

class RotationsTo {
  constructor() {
    // Target angles
    this.targetYaw = null;
    this.targetPitch = null;
    this.rotating = false;

    this.Speed = 50;
    this.tremorFrequency = 1;
    this.fadeExponent = 2.5;
    this.Randomness = 0.25;
    this.precision = 1;

    this.currentRandomYaw = 0;
    this.currentRandomPitch = 0;
    this.lastTremorTime = 0;
    this.lastUpdateTime = Date.now();
    this.targetVector = null;
    this.actions = [];

    register("postRenderWorld", () => {
      if (!this.rotating) return;

      let player = Player.getPlayer();
      if (!player) return;

      let now = Date.now();
      let deltaTime = (now - this.lastUpdateTime) / 1000;
      this.lastUpdateTime = now;

      let currentYaw = player.getYaw();
      let currentPitch = player.getPitch();

      if (this.targetVector) {
        let playerPos = player.getPos();
        let eyeHeight = player.getEyePos().y - playerPos.y;

        if (
          Math.floor(this.targetVector.x) === Math.floor(playerPos.x) &&
          Math.floor(this.targetVector.y) === Math.floor(playerPos.y) &&
          Math.floor(this.targetVector.z) === Math.floor(playerPos.z)
        ) {
          this.stopRotation();
          return;
        }

        let dx = this.targetVector.x - playerPos.x;
        let dy = this.targetVector.y - (playerPos.y + eyeHeight);
        let dz = this.targetVector.z - playerPos.z;

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

      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      let maxDiff = Math.max(Math.abs(yawDiff), Math.abs(pitchDiff));
      let normalizedDist = Math.min(maxDiff / 180, 1);
      let easingFactor = easeOutCubic(1 - normalizedDist);

      let mouseSensitivity =
        Client.getMinecraft().options.mouseSensitivity.getValue();
      let rotationFactor = this.Speed * mouseSensitivity * easingFactor;

      let newYaw = currentYaw + yawDiff * rotationFactor * deltaTime;
      let newPitch = currentPitch + pitchDiff * rotationFactor * deltaTime;

      if (now - this.lastTremorTime > 1000 / this.tremorFrequency) {
        this.currentRandomYaw = (Math.random() - 0.5) * this.Randomness;
        this.currentRandomPitch = (Math.random() - 0.5) * this.Randomness;
        this.lastTremorTime = now;
      }

      let fadeFactor = Math.pow(normalizedDist, this.fadeExponent);
      let jitterYaw = this.currentRandomYaw * fadeFactor;
      let jitterPitch = this.currentRandomPitch * fadeFactor;

      player.setYaw(newYaw + jitterYaw);
      player.setPitch(newPitch + jitterPitch);
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
    this.lastUpdateTime = Date.now();
  }

  rotateTo(vector) {
    let vec = Utils.convertToVector(vector);
    this.rotating = true;
    this.targetVector = new Vector(vec.x + 0.5, vec.y + 0.5, vec.z + 0.5);
    this.lastUpdateTime = Date.now();
  }

  onEndRotation(callBack) {
    this.actions.push(callBack);
  }

  stopRotation() {
    this.targetVector = null;
    this.rotating = false;
  }

  getPlayerRotation() {
    const player = Player.getPlayer();
    if (!player) return null;
    return { yaw: player.getYaw(), pitch: player.getPitch() };
  }
}

export const Rotations = new RotationsTo();
