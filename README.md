# V5 Developer README

General users should use the public docs:
https://rdbt.top/docs/getting-started

The rest of this README is for developers and contributors.

## License Summary

This project is licensed under **GNU GPL v3.0**. In short:

1. Anyone can copy, modify, and distribute this software.
2. Every distribution must include the license text and existing copyright notices.
3. You can use this software privately.
4. If you distribute modified versions, you must provide the complete source code under GPL-3.0.

- This means that any forks/copies/clones must have the source code freely available.

## Repositories

V5 is split across two repositories:

- **Fabric mod (V5Loader):** https://github.com/V5-Client/V5Loader  
  Contains the technical client internals (rendering, pathfinding, ChatTriggers JavaScript engine).
- **JavaScript module (V5):** https://github.com/V5-Client/V5  
  Contains macros/scripts used by the client.

## Creating Custom Macros & Modules

We highly recommend using UserScripts to create custom modules rather that modifiying the V5 source directly.

## Developing the JavaScript Module ([V5](https://github.com/V5-Client/V5))

1. In-game, run `/V5 developerMode true`.
   This disables auto-updater behavior so your local edits are not overwritten.
2. You can find the javascript source in `/minecraft/config/ChatTriggers/modules/V5`.
3. After making code changes, run `/ct load` to reload immediately.
4. Use `/ct console` to view the JavaScript console.

More detailed contributor docs may be added in the future.

## Ban Wave Guard

Open **Settings > Ban Wave Guard**. Monitoring uses **Plancke** by default and does not need an API key. The client requests `https://api.plancke.io/hypixel/v1/punishmentStats` every 30 seconds in a background thread and reads `record.staff_total`. If your game receives a Cloudflare challenge or an error instead of JSON, **Monitoring Status** reports unavailable data; access from a browser does not guarantee Java HTTP access from the same computer.

The **Banwave Monitor** HUD is shown in the upper right by default. It displays the monitoring/lock state, source, observed staff-ban count and threshold, actual sample coverage, Watchdog count, and time since the last update. Errors and missing data are shown as warnings, not zero bans. A triggered protection lock stays visible in red after the other features stop, including after a reload. Use **Show Banwave HUD**, **HUD Horizontal Position (%)**, **HUD Vertical Position (%)**, and **HUD Scale (%)** in the same settings section to hide, move, or resize the panel independently of macro overlays.

The default rule stops features when the observed `staff_total` increase within a rolling 15-minute window reaches **Staff Bans In 15 Minutes** (default: 30). This follows the staff-counter approach used in [LeafDevs/BanwaveChecker](https://github.com/LeafDevs/BanwaveChecker/blob/main/index.js). [FarmHelper](https://github.com/JellyLabScripts/FarmHelper/blob/master/src/main/java/com/jelly/farmhelperv2/feature/impl/BanInfoWS.java) similarly compares 15-minute ban counts against a threshold, but gets its counts from its own authenticated community service; this guard does not connect to that service. The rule is a heuristic based on network-wide staff bans, not an official SkyBlock-specific signal or a validated predictor.

Staff detection needs at least two successful samples. The first sample establishes a baseline, so a fresh installation cannot detect bans that happened before it started collecting. Fresh local samples survive `/ct load`; samples older than 15 minutes are discarded. Gaps longer than 90 seconds or a decreasing counter reset the baseline so outages and counter resets cannot be mistaken for waves. **Monitoring Status** shows the actual observed window, counts, source, errors, and age of the last successful request. API caching can delay detection; error responses are never treated as zero bans or a detected wave.

Optionally select **Hypixel API** as the statistics source to use the official [`/v2/punishmentstats`](https://api.hypixel.net/#tag/Other/paths/~1v2~1punishmentstats/get) endpoint. This source requires a Hypixel API key stored in local `V5Config/config.json`; the ban logger removes the key from config attachments. Do not share that file. **Also Check Watchdog** optionally enables the earlier Watchdog rule (`watchdog_lastMinute` >= **Watchdog Bans Per Minute**, default: 50); it is off by default.

When a threshold is reached, the guard disables enabled modules, clears the scheduler's pending session, and blocks module activation, including automatic recovery.

The lock survives `/ct load` and game restarts. Use **Unlock Features** to clear it, then enable the desired modules and scheduler manually. Turning off **Stop on Ban Wave** only stops polling; it does not clear the lock. If monitoring stays on and the threshold is still exceeded, the next poll will lock features again.

To install local edits, run `/V5 developerMode true` so the updater does not overwrite them, copy the changed files into your `config/ChatTriggers/modules/V5` folder, then run `/ct load`.
