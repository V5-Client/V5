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
- **JavaScript module (this repo):** https://github.com/V5-Client/V5  
  Contains macros/scripts used by the client.

## Working on the Fabric Mod ([V5Loader](https://github.com/V5-Client/V5Loader))

Run these commands from the `V5Loader` repository root.

### Build outputs

- `NativeSrc/build/V5PathJNI.so` (Linux)
- `NativeSrc/build/V5PathJNI.dylib` (macOS)
- `NativeSrc/build/Release/V5PathJNI.dll` or `NativeSrc/build/V5PathJNI.dll` (Windows)

### Bundle output into V5Loader

Copy the built library into:

- `src/main/resources/assets/v5/`

For production release commits, this copy step is handled automatically by GitHub Actions.

### Quick dev commands

Each command compiles native code, copies the output, runs API dump, then builds Kotlin.

- **Linux:**

```bash
cmake -S NativeSrc -B NativeSrc/build -DCMAKE_BUILD_TYPE=Release && cmake --build NativeSrc/build --config Release -j && cp ./NativeSrc/build/V5PathJNI.so ./src/main/resources/assets/v5/V5PathJNI.so && ./gradlew apiDump && ./gradlew build
```

- **macOS:**

```bash
cmake -S NativeSrc -B NativeSrc/build -DCMAKE_BUILD_TYPE=Release && cmake --build NativeSrc/build --config Release -j && cp ./NativeSrc/build/V5PathJNI.dylib ./src/main/resources/assets/v5/V5PathJNI.dylib && ./gradlew apiDump && ./gradlew build
```

- **Windows (PowerShell):**

```powershell
cmake -S NativeSrc -B NativeSrc/build -DCMAKE_BUILD_TYPE=Release; cmake --build NativeSrc/build --config Release --parallel; if (Test-Path .\NativeSrc\build\Release\V5PathJNI.dll) { Copy-Item .\NativeSrc\build\Release\V5PathJNI.dll .\src\main\resources\assets\v5\V5PathJNI.dll -Force } else { Copy-Item .\NativeSrc\build\V5PathJNI.dll .\src\main\resources\assets\v5\V5PathJNI.dll -Force }; .\gradlew apiDump; .\gradlew build
```

### Install built mod

After building, place the jar at:

- `.minecraft/V5/V5-Loader.jar`

## Working on the JavaScript Module ([V5](https://github.com/V5-Client/V5))

1. In-game, run `/V5 developerMode true`.
   This disables auto-updater behavior so your local edits are not overwritten.~
2. You are able to git clone into modules folder for ease of use.
3. After making code changes, run `/ct load` to reload immediately.
4. Use `/ct console` to view the JavaScript console.

More detailed contributor docs may be added in the future.