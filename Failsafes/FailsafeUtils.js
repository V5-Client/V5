import FailsafeConfig from './FailsafeConfig.js';

let failsafeIntensity = 0;

function getFailsafeSettings(name) {
    return FailsafeConfig.getFailsafeSettings(name);
}

function incrementFailsafeIntensity(amt) {
    failsafeIntensity += amt;
    setTimeout(() => failsafeIntensity -= (amt / 10), 1000);
}

function getIntensity() {
    return failsafeIntensity;
}

export { getFailsafeSettings, incrementFailsafeIntensity, getIntensity };