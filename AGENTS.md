# Repository Guidelines

Note: DO NOT WRITE "// ponytail:" COMMENTS. IF YOU WRITE A COMMENT (which should be a rare once every few hundred lines occurance), IT SHOULD DESCRIBE WHY THE CODE IS THERE, NOT WHAT IT DOES. NO EXCEPTIONS. DO NOT EVER WRITE "PONYTAIL" IN THE CODEBASE.

## Project Structure & Module Organization

V5 is a ChatTriggers JavaScript module. It runs on the [V5 ChatTriggers engine](https://github.com/V5-Client/V5Loader).
[`loader.js`](loader.js) boots core services, GUI, failsafes, and [`modules/loader.js`](modules/loader.js).
Feature code exists in the matching `modules/` category. (`mining/`, `farming/`, `combat/`, `foraging/`, `skills/`, `visuals/`, or `other/`)
Shared code belongs in `utils/`;
UI code lives in `gui/`;
failsafe implementations live in `failsafes/impl/`.
Keep images, SVGs, and bundled data in `assets/`.

Refer to `typings.d.ts` for the available runtime APIs. This is an extremely large file so do not attempt to read it all at once. Use searching methods to determin what you want.

## Build, Test, and Development Process

There is no package manifest, build step, or automated test runner. Do not attempt to make or run any tests.

You should run prettier formatting before completion.

The user will provide feedback on the results.
