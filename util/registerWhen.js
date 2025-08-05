const checkingTriggers = [];

/**
 * Registers and unregisters the trigger depending on the result of the checkFunc.
 * @param {() => void} trigger
 * @param {Function} checkFunc
 * @returns
 */
export function registerWhen(trigger, checkFunc) {
  trigger.unregister();
  checkingTriggers.push([trigger, checkFunc]);
}

register("step", () => {
  for (const [trigger, checkFunc] of checkingTriggers) {
    if (checkFunc()) {
      trigger.register();
    } else {
      trigger.unregister();
    }
  }
}).setFps(1);
