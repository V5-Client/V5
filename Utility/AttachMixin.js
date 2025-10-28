// Has to be in a seperate file so no error ;l

export function attachMixin(mixin, name, callback) {
    try {
        mixin.attach(callback);
    } catch (e) {
        global.showNotification(`Failed to attach ${name}`, e, 'ERROR');
    }
}
