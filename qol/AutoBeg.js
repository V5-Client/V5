(function () {
  const CONFIG_NAMESPACE = "ClientConfig";
  const CONFIG_NAME = "config.json";

  const DEFAULT = {
    enabled: false,
    intervalSeconds: 30,
    rank: "vip",
  };

  function loadConfig() {
    try {
      const raw = FileLib.read(CONFIG_NAMESPACE, CONFIG_NAME);
      const parsed = raw ? JSON.parse(raw) : {};
      const cfg = parsed.AutoBeg ? parsed.AutoBeg : {};
      return Object.assign({}, DEFAULT, cfg);
    } catch (e) {
      ChatLib.chat("&c[AutoBeg] Failed to read ClientConfig, using defaults: " + e);
      return Object.assign({}, DEFAULT);
    }
  }

  function saveConfig(cfg) {
    try {
      const raw = FileLib.read(CONFIG_NAMESPACE, CONFIG_NAME);
      let parsed = raw ? JSON.parse(raw) : {};
      parsed.AutoBeg = cfg;
      FileLib.write(CONFIG_NAMESPACE, CONFIG_NAME, JSON.stringify(parsed, null, 2));
    } catch (e) {
      ChatLib.chat("&c[AutoBeg] Failed to save to ClientConfig: " + e);
    }
  }

  class AutoBeg {
    constructor() {
      this.cfg = loadConfig();
      this.lastMessageTime = 0;

      this.messages = [
        `anyone got a spare rank pls??`,
        `hey can someone gift me a rank?`,
        `anyone nice enough to rank a noob :(`,
        `looking for a rank so i can unlock cool cosmetics :3`,
        `plz rank me i want to have fun`,
        `if anyone is feeling generous a rank would be epic plss`,
        `looking for a free rank to play with my friends :)`,
        `need a rank to flex on the noobs lol`,
        `anyone got any extra rank lying around they dont mind giving me :)`,
        `i cant afford a rank can i get one`,
        `pls rank me i will be your best friend forever`,
        `hey anyone willing to rank me up i'm new`,
        `pls give me a rank i will be your friend`,
        `can someone give me a rank im poor`,
        `anyone want to gift me a rank i want {rank_placeholder}`,
        `i need a rank so i can make a guild`,
        `can someone rank me i will give stuff`,
        `pls rank me i will do whatever you want`,
        `looking for a rank giveaway`,
        `anyone nice enough to give me {rank_placeholder}`,
        `i need a rank to be cool`,
        `anyone have an extra rank`,
        `i will pay you back for a rank later promise`,
        `can i get a free rank`,
        `if anyone is bored and feeling nice rank me`,
        `i have no rank i need one pls`,
        `hey can i get a rank im new to the game`,
        `pls give me a free rank`,
        `pls give me a rank i will do anything`,
        `anyone got any free ranks`,
        `can i please get a free rank`,
        `pls rank me i will be your friend for life`,
        `plz rank me i am poor`,
        `hey can anyone gift me a rank pls`,
        `looking for {rank_placeholder} gift`,
        `pls give me {rank_placeholder}`,
        `can anyone give me a rank so i can enjoy the game`,
        `looking for a free rank to join my friends game`,
        `need a rank so i can join my friends`,
        `can someone help me get a rank`,
        `pls give me rank`,
        `i want to join my friends game need a rank`,
        `can i have a free rank pls`,
        `pls rank me`,
        `looking for a {rank_placeholder} gift`,
        `pls give me {rank_placeholder} im sad`,
        `anyone got a {rank_placeholder} for me`,
        `i cant afford a rank pls help`,
        `can i have a rank gift pls`,
        `pls help me get a rank`,
        `pls rank me`,
        `looking for {rank_placeholder}`,
        `can i get a rank`,
        `can i have a rank`,
        `pls rank me`,
        `anyone nice to gift me {rank_placeholder}`,
        `pls gift me {rank_placeholder}`,
        `gift me {rank_placeholder}`,
        `need a rank pls`,
        `i need rank`,
        `someone gift me`,
        `rank pls`,
        `can someone give me {rank_placeholder}`,
        `i want {rank_placeholder}`,
        `any {rank_placeholder} giveaway`,
        `need rank to play with friends`,
        `gifting me a rank is ok`,
        `can someone give me rank`,
        `looking for {rank_placeholder} giveaway`,
        `give me rank`,
        `anyone got extra rank`,
        `can i have rank`,
        `anyone give {rank_placeholder}`,
        `gift me rank`,
        `pls can i get rank`,
        `can someone gift me rank`,
        `i need {rank_placeholder}`,
        `give me {rank_placeholder}`,
        `can i get a free rank`,
        `rank pls`,
        `pls i need a rank`,
        `need {rank_placeholder}`,
        `any rank giveaway`,
        `plz can i get rank`,
        `pls gift me a rank`,
        `anyone have a spare {rank_placeholder}?`,
      ];

      register("command", (...args) => {
        const sub = (args[0] || "").toString().toLowerCase();
          if (sub === "") {
            ChatLib.chat(`&dUsage: /autobeg
                &6toggle: &fSwitch between on/off 
                &6interval <seconds>: &fSet chat interval
                &6rank <name>: &fSet the rank to beg for 
                &6status: &fShow current status`);
    return;
  }
        if (sub === "toggle" || sub === "") {
          this.toggle();
          return;
        }
        if (sub === "interval") {
          const val = Number(args[1]);
          if (!isNaN(val) && val >= 5 && val <= 10000) { // minimum 5 seconds, max of 10000 seconds
            this.cfg.intervalSeconds = Math.max(5, Math.floor(val));
            saveConfig(this.cfg);
            ChatLib.chat(`&dAutoBeg: &bInterval set to ${this.cfg.intervalSeconds}s`);
          } else {
            ChatLib.chat("&cUsage: /autobeg interval <seconds> (min: 5, max: 10000)");
          }
          return;
        }
        if (sub === "rank") {
          const rank = String(args.slice(1).join(" ") || "").trim();
          if (rank) {
            this.cfg.rank = rank;
            saveConfig(this.cfg);
            ChatLib.chat(`&dAutoBeg: &bRank set to ${this.cfg.rank}`);
          } else {
            ChatLib.chat("&cUsage: /autobeg rank <rank>");
          }
          return;
        }
        if (sub === "status") {
          ChatLib.chat(`&dAutoBeg: &b${this.cfg.enabled ? "Enabled" : "Disabled"} &7| Interval: &b${this.cfg.intervalSeconds}s &7| Rank: &b${this.cfg.rank}`);
          return;
        }

        ChatLib.chat(`&cUnknown subcommand. &dUsage: /autobeg
                &6toggle: &fSwitch between on/off 
                &6interval <seconds>: &fSet chat interval
                &6rank <name>: &fSet the rank to beg for 
                &6status: &fShow current status`);
                
      }).setName("autobeg");

      register("step", () => {
        this.cfg = loadConfig();
      }).setDelay(20);

      register("step", () => {
        this.cfg = loadConfig();
        if (!this.cfg.enabled) return;
        try {
          if (!World.isLoaded()) return;
        } catch (e) {
        }

        const now = Date.now();
        if (now - this.lastMessageTime < this.cfg.intervalSeconds * 1000) return;

        const template = this.messages[Math.floor(Math.random() * this.messages.length)];
        const msg = template.replace(/\{rank_placeholder\}/g, this.cfg.rank);

        if (typeof ChatLib.say === "function") {
          ChatLib.say(msg);
        } else if (typeof ChatLib.chat === "function") {
          ChatLib.chat(msg);
        }

        try {
          ChatLib.command("internalrankgift true");
        } catch (e) {
        }

        this.lastMessageTime = now;
      }).setFps(1);

      if (this.cfg.enabled) this.lastMessageTime = Date.now();
    }

    toggle() {
      this.cfg.enabled = !this.cfg.enabled;
      saveConfig(this.cfg);
      const state = this.cfg.enabled ? "&aEnabled" : "&cDisabled";
      ChatLib.chat(`&dAutoBeg: &b${state}`);
      if (this.cfg.enabled) this.lastMessageTime = Date.now();
      else this.lastMessageTime = 0;
    }
  }

  new AutoBeg();

})();
