import { Chat } from "../Utility/Chat";
import { Keybind } from "../Utility/Keybinding";
import { MathUtils } from "../Utility/Math";

const smallBeachBall = "ewogICJ0aW1lc3RhbXAiIDogMTczNjQyNzQ4ODAwNCwKICAicHJvZmlsZUlkIiA6ICIzN2JhNjRkYzkxOTg0OGI4YjZhNDdiYTg0ZDgwNDM3MCIsCiAgInByb2ZpbGVOYW1lIiA6ICJTb3lLb3NhIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzJhZGY5ZDcxMzY3Y2Q2ZTUwNWZiNDhjYWFhNWFjZGNkZmYyYTA5ZjY2YzQ4OGRhZjA0ZDA0NWVlMGJmNTI4ZTEiLAogICAgICAibWV0YWRhdGEiIDogewogICAgICAgICJtb2RlbCIgOiAic2xpbSIKICAgICAgfQogICAgfQogIH0KfQ=="
const largeBeachBall = "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvODRiYzY4NDBmMDBkOGFlNDg2ZGFkNmU0N2U5NDJjOWQ0N2U3YTMwYzU0OTQ3ODIxZWJhN2I4YjE2Y2MwZjg1NyJ9fX0="

let enabled = false

let beachballer = register("tick", () => {
  if (!enabled) return beachballer.unregister()
  let g = World.getAllEntitiesOfType(Java.type("net.minecraft.entity.decoration.ArmorStandEntity").class)
  g.forEach((element, index) => {
  if (element.getStackInSlot(5)) {
    let beachBall = element.getStackInSlot(5).getNBT().toString()
    //console.log(beachBall)
  	if (beachBall.includes(smallBeachBall) || beachBall.includes(largeBeachBall)) {
      dx = element.getX() + (element.getX() - element.getLastX()) * 3
      dz = element.getZ() + (element.getZ() - element.getLastZ()) * 3
      let distance = MathUtils.calculateDistance([Player.getX(), Player.getY(), Player.getZ()], [dx, element.getY(), dz])
      if (distance.distance > 15) return
      Keybind.setKey("shift", true)
      if (distance.distanceFlat > 0.5) {
        Keybind.setKeysForStraightLineCoords(dx, element.getY(), dz)
      }
      if (distance.distanceFlat < 0.2) {
        Keybind.stopMovement()
      }
  	}
  };
});
})

register("command", () => {
  enabled = !enabled
  Chat.message(enabled ? "BeachBaller enabled" : "BeachBaller disabled")
  if (!enabled) {
    beachballer.unregister()
  }
  if (enabled) {
    beachballer.register()
  }
}).setName("beachball")
