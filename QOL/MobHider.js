class MobHider {
  constructor() {
    this.kalhuikis = false;
    this.svenpups = false;
    this.thysts = false;
    this.jerry = false;

    this.jerryNames = new Set([
      "Green Jerry",
      "Blue Jerry",
      "Purple Jerry",
      "Golden Jerry",
    ]);

    if (this.kalhuikis) this.hideKalhuiki();
    if (this.svenpups) this.hidePup();
    if (this.thysts) this.hideThyst();
    if (this.jerry) this.hideJerry();
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
