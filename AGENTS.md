# AGENTS.md

This file defines project-specific rules for AI coding agents working in this repository.

## 1. Project Context (Read First)
- Runtime: ChatTriggers JavaScript module for Minecraft `1.21.10`.
- Entry point: `loader.js` (imports command system, GUI, config init, backend, core utils, modules).
- Module metadata: `metadata.json` (`entry: loader.js`, requires `requestV2`, `WebSocket`).
- Formatting baseline: `.prettierrc.json` and CI auto-format workflow (`.github/workflows/auto-prettier.yml`).
- There is no formal unit test suite in-repo. Validation is mostly runtime/manual.

## 2. Repository Map and Ownership
- `modules/`: user-facing feature modules (mining, farming, visuals, skills, other, combat).
- `failsafes/`: detection logic and reaction utilities.
- `utils/`: core abstractions (ModuleBase, commands, config, pathfinding, player helpers, backend comms).
- `gui/`: V5 GUI system, category/component model, overlay and notification rendering.
- `assets/`: static resources (icons, warp points, helper exe, etc.).

When editing, preserve boundaries:
- Feature logic in `modules/`.
- Shared primitives in `utils/`.
- Do not duplicate helper logic in modules if a util already exists.

## 3. Golden Rules for New/Edited Modules
- Prefer extending `ModuleBase` for every toggleable feature.
- Use object-style `super({...})` options; set these correctly:
  - `isMacro: true` only for true macro runners.
  - `hideInModules: true` for internal controllers (e.g., scheduler/controllers).
  - `showEnabledToggle: false` when keybind/parent-managed enable flow is intended.
- For macro modules, call `bindToggleKey()` and ensure clean `onEnable()/onDisable()` symmetry.
- Register event listeners with `this.on(...)` (or `this.when(...)`) so they auto-unregister on disable.
- If you must use global `register(...)`, justify it (always-on behavior only) and avoid leaks.
- Always add new user-visible modules to `modules/loader.js` imports.

## 4. Event Lifecycle and Safety
- Any per-tick/per-render path must be cheap and early-return aggressively.
- Guard runtime assumptions (`World.isLoaded()`, player/container/entity existence).
- Use `step` + `.setDelay(...)` instead of heavy `tick` where possible.
- Wrap risky callbacks in try/catch if not already guarded by helper wrappers.
- On disable/world unload, release everything:
  - movement/key holds,
  - rotations/pathing state,
  - overlay timers,
  - temporary trackers/timeouts.

## 5. Threading, Scheduling, and Main-Thread Constraints
- Use `ScheduleTask(...)` for delayed safe main-thread actions.
- Use `Executor.execute(...)` only for background work that does not directly mutate unsafe client state.
- Never run blocking network/file loops on render/tick callbacks.
- Cleanly stop background services on unload (`gameUnload` handlers already used in many managers).

## 6. Config and Persistence Rules
- Use `Utils.getConfigFile(...)` / `Utils.writeConfigFile(...)` for JSON in `V5Config`.
- Do not use ad-hoc file writes unless there is a clear reason.
- Save user state on `gameUnload` (and optionally on `guiClosed` for GUI positions).
- Preserve shape compatibility:
  - Range slider values are objects like `{ low, high }`.
  - Multi-toggle values may be option objects; do not assume plain string arrays.
- If adding a new persistent file, ensure `utils/Config.js` manifest includes sensible defaults.

## 7. GUI/Settings Integration
- Add module controls through `ModuleBase` wrappers (`addToggle`, `addSlider`, `addDirectToggle`, etc.), not by manually mutating GUI internals.
- For settings-page controls, provide consistent `sectionName` grouping.
- Keep callback behavior type-safe:
  - Multi-toggle callbacks may receive objects (`{name, enabled}`), not only strings.
  - Color picker callbacks use `java.awt.Color`.
- When adding overlays, use `OverlayManager` and keep position persistence in `OverlayPositions/*.json`.

## 8. Commands and Chat Output
- Register internal commands via `v5Command(...)`.
- Wire user-facing command syntax under `/v5` in `utils/V5Commands.js`.
- Use `Chat` helper methods for output (`message`, `messageDebug`, `messageFailsafe`, etc.).
- Keep debug spam behind debug toggles (`DebugState`) and avoid noisy chat in hot loops.

## 9. Failsafe-Specific Rules
- New failsafes should extend `failsafes/Failsafe`.
- Respect temporary disable windows around world/server/warp/death transitions.
- Pull settings from `FailsafeUtils.getFailsafeSettings(...)` and honor user config toggles.
- On trigger:
  - provide clear in-chat context,
  - increment failsafe intensity appropriately,
  - send webhook/embed only through existing utility paths.
- Do not add reaction logic that can deadlock movement/input state after disable.

## 10. Pathfinder Integration Rules
- Use `Pathfinder` / `PathExecutor` APIs; do not create competing movement loops.
- On module disable or abort states, reset path and movement helpers deterministically.
- Guard against no-path and timeout conditions; always handle fallback states.
- Keep render-debug optional behind existing path debug flags.

## 11. Backend / Security Hygiene
- Treat auth/webhook data as sensitive. Never log JWTs, webhook URLs, or secrets.
- Avoid introducing privileged remote actions without explicit review.
- Keep reconnect logic bounded; follow existing backoff patterns.
- Prefer existing `Links` constants and backend helpers over hardcoding endpoints.

## 12. Formatting and Style Requirements
- Follow current Prettier settings:
  - `tabWidth: 4`, `singleQuote: true`, `semi: true`, `printWidth: 160`, trailing commas `es5`.
- Match surrounding code style and naming patterns.
- Avoid large opportunistic refactors unless requested.
- Keep imports relative and correctly cased.

## 13. Common AI Failure Modes in This Repo (Avoid These)
- Forgetting to add a new module import in `modules/loader.js`.
- Using raw `register(...)` in modules and leaking listeners after toggle off.
- Forgetting to clear timers/timeouts/registers in `onDisable`.
- Writing config in inconsistent file paths or wrong data shape.
- Mis-handling multi-toggle callback values (treating objects as strings).
- Running expensive scans every tick without throttling/caching.
- Emitting chat messages inside very high-frequency loops.
- Breaking macro parent-management semantics (`toggle(value, parentManaged, context)`).
- Not preserving existing behavior for scheduler/failsafe interactions.

## 14. Manual Validation Checklist (Run Before Finishing Changes)
- Module toggles on/off cleanly; no stuck keys/movement.
- No console exceptions during idle for at least ~30 seconds in relevant context.
- Settings persist across reload (`config.json` or module-specific config files).
- Keybinds persist after `gameUnload`.
- Overlay positions/timers behave correctly after enable/disable.
- World change / warp / death transitions do not leave module in broken state.
- `/v5` command paths still execute and show expected usage/help.

## 15. Scope Discipline
- Implement the smallest safe change that solves the user request.
- Do not silently change unrelated behavior.
- If touching high-risk areas (failsafes, pathing, scheduler, backend), include explicit regression checks in your final summary.
