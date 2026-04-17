const CONFIG_ROOT = 'V5Config';
const STATE_FILE = 'developerMode.json';

let developerModeEnabled = false;
let loadedFromDisk = false;

const saveDeveloperModeState = () => {
    try {
        FileLib.write(CONFIG_ROOT, STATE_FILE, JSON.stringify({ enabled: developerModeEnabled }, null, 2));
    } catch (e) {
        console.error('V5 developer mode state write failed:', e);
    }
};

export const loadDeveloperModeState = () => {
    loadedFromDisk = true;

    try {
        if (!FileLib.exists(CONFIG_ROOT, STATE_FILE)) {
            developerModeEnabled = false;
            saveDeveloperModeState();
            return developerModeEnabled;
        }

        const raw = FileLib.read(CONFIG_ROOT, STATE_FILE);
        const payload = JSON.parse(raw || '{}');
        developerModeEnabled = !!payload.enabled;
    } catch (e) {
        developerModeEnabled = false;
        console.error('V5 developer mode state read failed:', e);
        saveDeveloperModeState();
    }

    return developerModeEnabled;
};

export const setDeveloperModeEnabled = (value) => {
    developerModeEnabled = !!value;
    loadedFromDisk = true;
    saveDeveloperModeState();
    return developerModeEnabled;
};

export const isDeveloperModeEnabled = () => {
    if (!loadedFromDisk) loadDeveloperModeState();
    return developerModeEnabled;
};
