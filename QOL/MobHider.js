class MobHider {
  constructor() {
    this.kalhuikis = false;
    this.svenpups = false;
    this.thysts = false;
    this.jerry = false;

    this.jerryNames = [
      "Green Jerry",
      "Blue Jerry",
      "Purple Jerry",
      "Golden Jerry",
    ];
    
    this.thystRenderEntity = register("renderEntity", (ent, pt, event) => {
      let cleanname = ChatLib.removeFormatting(ent.getName());
      if (cleanname === "Endermite" || ent.getName().includes("Thyst")) {
        cancel(event);
      }
    }).unregister();

    this.thystSpawnParticle = register("spawnParticle", (particle, event) => {
      if (particle == null) return;
      if (particle.toString().includes("class_709")) {
        cancel(event);
      }
    }).unregister();

    this.thystPlayerInteract = register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Endermite")
        ) {
          cancel(event);
        }
      }
    }).unregister();
    
    this.pupRenderEntity = register("renderEntity", (ent, pt, event) => {
      let cleanname = ChatLib.removeFormatting(ent.getName());
      if (cleanname.includes("Sven Pup")) {
        cancel(event);
      }
    }).unregister();

    this.pupPlayerInteract = register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Sven Pup")
        ) {
          cancel(event);
        }
      }
    }).unregister();
    
    this.jerryRenderEntity = register("renderEntity", (ent, pt, event) => {
      if (this.jerryNames.some((name) => ent.getName().includes(name))) {
        cancel(event);
      }
    }).unregister();

    this.jerryPlayerInteract = register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Jerry")
        ) {
          cancel(event);
        }
      }
    }).unregister();
    
    this.kalhuikiRenderEntity = register("renderEntity", (ent, pt, event) => {
      let cleanname = ChatLib.removeFormatting(ent.getName());
      if (cleanname.includes("Kalhuiki")) {
        cancel(event);
      }
    }).unregister();

    this.kalhuikiPlayerInteract = register("playerInteract", (action, pos, event) => {
      if (action.toString().includes("AttackEntity")) {
        let attackedEntity = Player.lookingAt();

        if (
          attackedEntity instanceof Entity &&
          attackedEntity?.toString()?.includes("Kalhuiki")
        ) {
          cancel(event);
        }
      }
    }).unregister();
  }

  toggleThyst(enabled = true) {
    if (enabled) {
      this.thystRenderEntity.register();
      this.thystSpawnParticle.register();
      this.thystPlayerInteract.register();
    } else {
      this.thystRenderEntity.unregister();
      this.thystSpawnParticle.unregister();
      this.thystPlayerInteract.unregister();
    }
  }

  togglePup(enabled = true) {
    if (enabled) {
      this.pupRenderEntity.register();
      this.pupPlayerInteract.register();
    } else {
      this.pupRenderEntity.unregister();
      this.pupPlayerInteract.unregister();
    }
  }

  toggleJerry(enabled = true) {
    if (enabled) {
      this.jerryRenderEntity.register();
      this.jerryPlayerInteract.register();
    } else {
      this.jerryRenderEntity.unregister();
      this.jerryPlayerInteract.unregister();
    }
  }

  toggleKalhuiki(enabled = true) {
    if (enabled) {
      this.kalhuikiRenderEntity.register();
      this.kalhuikiPlayerInteract.register();
    } else {
      this.kalhuikiRenderEntity.unregister();
      this.kalhuikiPlayerInteract.unregister();
    }
  }
}

//MobHider.toggleThyst()
new MobHider();
