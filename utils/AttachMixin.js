//import { showNotification } from '../gui/NotificationManager';

// Has to be in a seperate file so no error ;l

export function attachMixin(mixin, name, callback) {
    try {
        mixin.attach(callback);
        java.lang.System.out.println('V5: Mixin attached: ' + name);
    } catch (e) {
        //showNotification(`Failed to attach ${name}`, e, 'ERROR');
    }
}
