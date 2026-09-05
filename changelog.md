# Changelog

## V5.2.0 - 26.2 Support

### New features

- Support for Vulkan Rendering, which can greatly improve FPS.
- Added an in-game changelog, found in the bottom left of the GUI.
- Added Documentation and keybind buttons to module settings.
- Mining Bot and Ore Macro now automatically refuel empty drills.

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
- Fix Profile Hider username replacements breaking surrounding text.

### Improvements

- Significantly improved GUI, overlay, and rendering performance.
- Invalid /v5 commands now show an error instead of sending to server.
- Pathfinder warns if a destination is in an unloaded chunk.

### User Safety

- Auto updater now uses github as the download source instead of rdbt backend.
- This can be independantly audited and reviewed to prove there is no RAT.
