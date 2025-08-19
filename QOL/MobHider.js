class MobHider {
  constructor() {
    this.kalhuikis = false;
    this.svenpups = false;
    this.thysts = true;
    this.jerry = false;

    this.kalhuikis ? this.hideJerry() : (this.kalhuikis = null);
    this.svenpups ? this.hidePup() : (this.svenpups = null);
    this.thysts ? this.hideThyst() : (this.thysts = null);
    this.jerry ? this.hideJerry() : (this.jerry = null);
  }

  hideThyst() {
    register("renderEntity", (ent, pt, event) => {
      let cleanname = ChatLib.removeFormatting(ent.getName());
      if (cleanname === "Endermite" || ent.getName().includes("Thyst")) {
        cancel(event);
      }
    });

    register("spawnParticle", (particle, event) => {
      if (particle == null) return;
      if (particle.toString().includes("class_709")) {
        cancel(event);
      }
    });

    register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Endermite")
        ) {
          cancel(event);
        }
      }
    });
  }

  hidePup() {
    register("renderEntity", (ent, pt, event) => {
      let cleanname = ChatLib.removeFormatting(ent.getName());
      if (cleanname.includes("Sven Pup")) {
        cancel(event);
      }
    });

    register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Sven Pup")
        ) {
          cancel(event);
        }
      }
    });
  }

  hideJerry() {
    register("renderEntity", (ent, pt, event) => {
      this.jerryNames = [
        "Green Jerry",
        "Blue Jerry",
        "Purple Jerry",
        "Golden Jerry",
      ];

      if (this.jerryNames.some((name) => ent.getName().includes(name))) {
        cancel(event);
      }
    });

    register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Jerry")
        ) {
          cancel(event);
        }
      }
    });
  }

  hideKalhuiki() {
    register("renderEntity", (ent, pt, event) => {
      let cleanname = ChatLib.removeFormatting(ent.getName());
      if (cleanname.includes("Kalhuiki")) {
        cancel(event);
      }
    });

    register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Kalhuiki")
        ) {
          cancel(event);
        }
      }
    });
  }
}

new MobHider();
