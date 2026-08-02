const V5MixinStorage = Java.type('com.v5.storage.V5MixinStorage');
const STORAGE_KEY = 'V5Mixin.storage';
const properties = java.lang.System.getProperties();
const existing = properties.get(STORAGE_KEY);
const storage = existing instanceof java.util.HashMap ? existing : new java.util.HashMap();

if (storage !== existing) properties.put(STORAGE_KEY, storage);

export function setMixinValue(key, value) {
    storage.put(key, value);
    V5MixinStorage.set(key, value);
}

export const getMixinValue = (key, defaultValue = null) => V5MixinStorage.get(key, defaultValue);

export function setMixinMethod(name, callback) {
    if (typeof callback !== 'function') return;
    setMixinValue(`method_${name}`, callback);
}

export function deleteMixinValue(key) {
    storage.remove(key);
    V5MixinStorage.set(key, null);
}
