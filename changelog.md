# Changelog

## V5.2.0 - 26.2 Support

### New features

- Added an in-game changelog, opened by clicking the version button in the GUI.
- Mining Bot and Ore Macro now automatically refuel empty drills and resume afterward.
- Added Docs and keybind buttons to module settings, making it easier to learn about modules and change their controls.

### Improvements

- Significantly improved GUI and overlay performance.
- Improved configuration saving.
- Invalid /v5 commands now show an error instead of sending to server.
- Pathfinder now states if a destination is in an unloaded chunk.

### Profile Hider

- Improved Profile Hider so username replacements retain the surrounding text styling.
- Custom usernames now support #RRGGBBName colors, legacy & or section-sign formatting codes, and chroma text when no color is specified.

### Fixes

- Fixed Mining Bot ability events interrupting automatic refueling.
- Mining Bot and Ore Macro now stop safely with a clear message if refueling fails or the drill cannot be found afterward.
- Fixed Commission Macro reacting to a completed refuel after the macro had already stopped.
- Fixed failsafe webhook alerts failing to send in some cases.
- Fixed crashes or incorrect behavior caused by method-name conflicts in Combat Bot, Auto Experiments, and Minion Collector.
- Fixed the GUI occasionally rendering multiple times after being reopened.
- Fixed the GUI failing to initialize correctly in some situations.
- Fixed Picture-in-Picture using an outdated chat function.
- Fixed several missed imports that could cause features to fail after reloading.
