import { Timers } from "./Timing";
import { Utils } from "./Main";

class Movement {
  constructor() {
    this.cooldown = Timers;
  }

  setKey(key, down) {
    if (Client.isInGui() && !Client.isInChat()) return;
    if (key === "a") {
      mc.options.leftKey.setPressed(down);
    }
    if (key === "d") {
      mc.options.rightKey.setPressed(down);
    }
    if (key === "s") {
      mc.options.backKey.setPressed(down);
    }
    if (key === "w") {
      mc.options.forwardKey.setPressed(down);
    }
    if (key === "space") {
      mc.options.jumpKey.setPressed(down);
    }
    if (key === "shift") {
      mc.options.sneakKey.setPressed(down);
    }
    if (key === "leftclick") {
      mc.options.attackKey.setPressed(down);
    }
    if (key === "sprint") {
      mc.options.sprintKey.setPressed(down);
    }
  }

  isKeyDown(key) {
    if (key === "a") {
      return mc.options.leftKey.isPressed();
    }
    if (key === "d") {
      return mc.options.rightKey.isPressed();
    }
    if (key === "s") {
      return mc.options.backKey.isPressed();
    }
    if (key === "w") {
      return mc.options.forwardKey.isPressed();
    }
    if (key === "space") {
      return mc.options.jumpKey.isPressed();
    }
    if (key === "shift") {
      return mc.options.sneakKey.isPressed();
    }
    if (key === "leftclick") {
      return mc.options.sneakKey.isPressed();
    }
    if (key === "sprint") {
      return mc.options.sprintKey.isPressed();
    }
  }

  setKeysBasedOnYaw(yaw, jump = true) {
    this.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;
    if (yaw >= -50.0 && yaw <= 50.0) {
      this.setKey("w", true);
    }
    if (yaw >= -135.5 && yaw <= -7.0) {
      this.setKey("a", true);
    }
    if (yaw >= 7.0 && yaw <= 135.5) {
      this.setKey("d", true);
    }
    if (yaw <= -135.5 || yaw >= 135.5) {
      this.setKey("s", true);
    }
    this.setKey(
      "space",
      Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.04 &&
        this.cooldown.hasReached(500) &&
        jump &&
        Utils.playerIsCollided()
    );
  }

  setKeysBasedOnYawTemp(yaw, jump = true) {
    this.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;
    if (yaw >= -50.0 && yaw <= 50.0) {
      this.setKey("w", true);
    }
    if (yaw >= -135.5 && yaw <= -40.0) {
      this.setKey("a", true);
    }
    if (yaw >= 40.0 && yaw <= 135.5) {
      this.setKey("d", true);
    }
    if (yaw <= -135.5 || yaw >= 135.5) {
      this.setKey("s", true);
    }
    this.setKey(
      "space",
      Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.02 &&
        this.cooldown.hasReached(500) &&
        jump &&
        Utils.playerIsCollided()
    );
  }

  setKeysForStraightLine(yaw, jump = true) {
    this.stopMovement();
    if (Client.isInGui() && !Client.isInChat()) return;
    if (22.5 > yaw && yaw > -22.5) {
      // Forwards
      this.setKey("w", true);
    } else if (-22.5 > yaw && yaw > -67.5) {
      // Forwards+Right
      this.setKey("w", true);
      this.setKey("a", true);
    } else if (-67.5 > yaw && yaw > -112.5) {
      // Right
      this.setKey("a", true);
    } else if (-112.5 > yaw && yaw > -157.5) {
      // Backwards + Right
      this.setKey("a", true);
      this.setKey("s", true);
    } else if ((-157.5 > yaw && yaw > -180) || (180 > yaw && yaw > 157.5)) {
      // Backwards
      this.setKey("s", true);
    } else if (67.5 > yaw && yaw > 22.5) {
      // Forwards + Left
      this.setKey("w", true);
      this.setKey("d", true);
    } else if (112.5 > yaw && yaw > 67.5) {
      // Left
      this.setKey("d", true);
    } else if (157.5 > yaw && yaw > 112.5) {
      // Backwards+Left
      this.setKey("s", true);
      this.setKey("d", true);
    }
    this.setKey(
      "space",
      Player.asPlayerMP().isInWater() ||
        (Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.02 &&
          this.cooldown.hasReached(500) &&
          jump &&
          Utils.playerIsCollided())
    );
  }

  setCooldown() {
    this.cooldown.reset();
  }

  stopMovement() {
    this.setKey("a", false);
    this.setKey("s", false);
    this.setKey("d", false);
    this.setKey("w", false);
    this.setKey("space", false);
  }

  unpressKeys() {
    this.stopMovement();
    this.setKey("shift", false);
  }
}

export const Moving = new Movement();
