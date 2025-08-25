import { Chat } from "../Utility/Chat";
import { Keybind } from "../Utility/Keybinding";
import { MathUtils } from "../Utility/Math";
import { Guis } from "../Utility/Inventory";
import { Rotations } from "../Utility/Rotations";

const smallBeachBallHash = "2adf9d71367cd6e505fb48caaa5acdcddf2a09f66c488daf04d045ee0bf528e1";
const largeBeachBallHash = "84bc6840f00d8ae486dad6e47e942c9d47e7a30c54947821eba7b8b16cc0f857";

let enabled = false;
let bounceCount = 0;
let tickCounter = 0
let bounceTimer = 0;
let startPos = [0, 0];

const states = {
  WAITING: 0,
  BOUNCE: 1,
  RETURN: 2,
  PLACE: 3,
};
let state = states.WAITING;

let beachballer = register("tick", () => {
  if (!enabled) return beachballer.unregister();
  if (Client.isInGui() && !Client.isInChat()) return toggle()
  switch (state) {
    case states.WAITING:
      break;
    case states.BOUNCE:
        if (bounceCount > 40) {
          setState(states.RETURN);
          bounceCount = 0
          return;
        }
        let currentYaw = Player.getYaw()
        Rotations.rotateToAngles(currentYaw, -90)
      let stands = World.getAllEntitiesOfType(Java.type("net.minecraft.entity.decoration.ArmorStandEntity").class);
      stands.forEach((element, index) => {
        if (element.getStackInSlot(5)) {
          let beachBall = element.getStackInSlot(5).getNBT().toString();
          if (beachBall.includes(smallBeachBallHash) || beachBall.includes(largeBeachBallHash)) {
            tickCounter = 0
            dx = element.getX() + (element.getX() - element.getLastX()) * 3;
            dz = element.getZ() + (element.getZ() - element.getLastZ()) * 3;
            let distance = MathUtils.calculateDistance([Player.getX(), Player.getY(), Player.getZ()], [dx, element.getY(), dz]);
            if (distance.distance > 15) return;
            Keybind.setKey("shift", true);
            if (distance.distanceFlat > 0.5) {
              Keybind.setKeysForStraightLineCoords(dx, element.getY(), dz);
            }
            if (distance.distanceFlat < 0.2) {
              Keybind.stopMovement();
            }
          }
        }
      });
      tickCounter++
      if (tickCounter > 10) {
        setState(states.RETURN);
      }
      break;
    case states.RETURN:
      Keybind.unpressKeys()
      if (MathUtils.calculateDistance([Player.getX(), Player.getY(), Player.getZ()], startPos).distance < 2) {
        Keybind.rightClick();
        setState(states.PLACE);
        return
      } else Rotations.rotateTo([startPos[0], startPos[1] + 2, startPos[2]])
      Keybind.setKeysForStraightLineCoords(startPos[0], startPos[1], startPos[2]);
      break;
    case states.PLACE:
      let stand = World.getAllEntitiesOfType(Java.type("net.minecraft.entity.decoration.ArmorStandEntity").class);
      stand.forEach((element, index) => {
        if (element.getStackInSlot(5)) {
          let beachBall = element.getStackInSlot(5).getNBT().toString();
          if (beachBall.includes(smallBeachBallHash) || beachBall.includes(largeBeachBallHash)) {
            setState(states.BOUNCE);
          }
        }
      });
      let ballslot = Guis.findItemInHotbar("Bouncy Beach Ball")
      if (ballslot === -1) {
        Chat.message("No bouncy balls in hotbar!")
        beachballer.unregister()
        return
      } else {
        Player.setHeldItemIndex(ballslot)
      }
      tickCounter++
      if (tickCounter % 10 == 0) Keybind.rightClick();
      break;
  }
}).unregister();

function setState(newState) {
  state = newState;
  tickCounter = 0;
  Chat.message("State changed to: " + state);
}

function toggle() {
  enabled = !enabled;
  Chat.message(enabled ? "BeachBaller enabled" : "BeachBaller disabled");
  if (!enabled) {
    beachballer.unregister();
  }
  if (enabled) {
    setState(states.PLACE);
    startPos = [Player.getX(), Player.getY(), Player.getZ()];
    beachballer.register();
  }
}

register("actionBar", (text) => {
  const clean = ChatLib.removeFormatting(text);
  const match = clean.match(/Bounces: (\d{1,3})/);
  if (match) {
    bounceCount = match[1];
    bounceTimer = Date.now();
  }
  if (Date.now() - bounceTimer > 2000) {
    bounceCount = 0;
  }
}).setCriteria("${text}");

register("command", () => {
  toggle()
}).setName("beachball");

