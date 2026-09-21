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
