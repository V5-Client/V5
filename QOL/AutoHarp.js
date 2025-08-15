import { Guis } from "../Utility/Inventory";

class AutoHarp {
  constructor() {
    this.ModuleName = "Auto Harp";
    this.delay = 5;
    this.toggled = true;

    class Note {
      constructor(slot) {
        this.slot = slot;
        this.clicked = false;
        this.delay = 0;
      }
    }

    const notes = [37, 38, 39, 40, 41, 42, 43].map((slot) => new Note(slot));

    register("tick", () => {
      if (!this.toggled) return;

      const invName = Guis.guiName();
      if (!invName?.includes("Harp")) return;

      const container = Player.getContainer();
      if (!container) return;

      notes.forEach((note) => {
        if (note.delay > 0) note.delay--;

        const item = container
          .getStackInSlot(note.slot)
          ?.type?.getRegistryName();

        if (!item || item.includes("terracotta")) {
          note.clicked = false;
          note.delay = 0;
        }

        if (item?.includes("quartz")) {
          if (note.clicked || note.delay !== 0) return;

          const belowItem = container
            .getStackInSlot(note.slot - 9)
            ?.type?.getRegistryName();
          if (belowItem?.includes("wool")) {
            note.delay = this.delay;
          } else {
            note.clicked = true;
          }

          Guis.clickSlot(note.slot, false, "MIDDLE");
        }
      });
    });
  }
}

new AutoHarp();
