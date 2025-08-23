import { Chat } from "../Utility/Chat";
import { Keybind } from "../Utility/Keybinding";
import { MathUtils } from "../Utility/Math";
import { Guis } from "../Utility/Inventory";
import { Rotations } from "../Utility/Rotations";

const smallBeachBall =
  "ewogICJ0aW1lc3RhbXAiIDogMTczNjQyNzQ4ODAwNCwKICAicHJvZmlsZUlkIiA6ICIzN2JhNjRkYzkxOTg0OGI4YjZhNDdiYTg0ZDgwNDM3MCIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb3lLb3NhIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzJhZGY5ZDcxMzY3Y2Q2ZTUwNWZiNDhjYWFhNWFjZGNkZmYyYTA5ZjY2YzQ4OGRhZjA0ZDA0NWVlMGJmNTI4ZTEiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ==";
const largeBeachBall = "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvODRiYzY4NDBmMDBkOGFlNDg2ZGFkNmU0N2U5NDJjOWQ0N2U3YTMwYzU0OTQ3ODIxZWJhN2I4YjE2Y2MwZjg1NyJ9fX0=";

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
          if (beachBall.includes(smallBeachBall) || beachBall.includes(largeBeachBall)) {
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
          if (beachBall.includes(smallBeachBall) || beachBall.includes(largeBeachBall)) {
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
});

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

