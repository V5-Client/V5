# Changelog

## V5.2.0 - 26.2 Support

### New features

- Support for Vulkan Rendering, which can greatly improve FPS.
- Added an in-game changelog, found in the bottom left of the GUI.
- Added Documentation and keybind buttons to module settings.
- Mining Bot and Ore Macro now automatically refuel empty drills.
- Added Discord authentication and account status to the dashboard, with an option to re-authenticate.
- Stridersurfer Macro now supports the Helix Chopper.

### Powder Nuker

- Automatically nukes hardstone within a selected Crystal Hollows region.
- Regions -> Jungle, Mines of Divan, Goblin Hideout, and Precursor Remnants
- Snail Mode that disables sneaking due to 100 speed.
- Moves down layers when there is no hardstone left nearby.
- Automatically refuels through an Abiphone.

(powder nuker macro clip here)

### Ore Macro

- New route-based mining macro that walks/etherwarps between waypoints and mines ore waypints.
- Build and manage saved routes through a route editor GUI.
- Use `/v5 mining ore` for command help, with `list`, `load <name>`, `save <name>`, `start`, `stop`, `status`, and `edit` commands.
- Places mining deployables.
- Automatically activates mining abilities when ready, with rod swapping for autopet rules.
- Automatically refuels empty drills and restarts the route afterward.

(ore macro clip here)

### Mining Bot

- Improved Mining Bot target selection and rotations, including retrying stubborn blocks at a different aim point.
- Added Mining Rotation Speed, Sneak While Mining, Minimum Visible Rays, and Block Reach settings to Mining Bot.
- Mining Bot now approaches visible blocks outside mining reach and stops movement once they are reachable.
- Added Precision Miner particle aiming and stopped mining rotations while menus are open or abilities are being activated.

### Nuker

- Nuker now follows treasure chest lock particles to solve chests without max Great Explorer.

### Farming

- Auto Philip Bonus can now contact Philip through an Abiphone or `/call Philip`, avoiding a trip to the barn when no other barn tasks are needed.
- Moved Visitor Macro, Auto Philip Bonus, and Pest Killer rewarp options into settings popups.
- Standardized Farming Delays settings to milliseconds, with adjustable ranges from 50 to 1,000 ms.

### Bazaar NPC Macro

- Added Bazaar to NPC, a macro that finds Bazaar items priced below their NPC sell value, places buy orders, claims filled items, and sells them through `/trades`.
- Requires Cookie Buff for `/bz`.
- Empty your inventory before using, I am not responsible for it npc selling your terminator.

- Due to how this money making method works, it is entirely based on activity so as more people use the macro, the less money you will make.
- The profit also highly depends on what items are availible to flip so it can range from 5 -> 100 million coins per hour.
- The `Hourly Profit` shown in the overlay is an esimate assuming you are never outbid.
- Hypixel has a 500 million coin NPC sell limit which will limit how long you can run the macro for.
- In private testing, this macro makes roughly ~150M per day, running for 2-4 hours before NPC limit is reached.

(bazaar npc clip here)

### Auto Forge

- Automatically forges items and claims completed ones.

### Picture-in-Picture

- Run `/v5 pip` to toggle.

### Auto Superpairs

- Automatically completes superpairs.
- This means that the entire experimentation is now automated and fully AFK.
- Can be selected to target or ignore XP pairs.

### Profile Hider

- Custom usernames now support #RRGGBBName colors, legacy, section-sign formatting, and chroma text (default).

### Improvements

- Significantly improved GUI, overlay, and rendering performance.
- Invalid /v5 commands now show an error instead of sending to server.
- Pathfinder warns if a destination is in an unloaded chunk.
- The GUI now shows the client version and an error indicator when no Discord profile picture is available.
- Fixed mana detection for the updated hypixel action bar.

### User Safety

- Auto updater now uses github as the download source instead of rdbt backend.
- This can be independantly audited and reviewed to prove there is no RAT.
