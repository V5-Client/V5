export function attachMixin(mixin, name, callback) {
    try {
        mixin.attach(callback);
    } catch (e) {
        /*Client.getMinecraft().execute(() => {
        const NotificationManager = require('../gui/NotificationManager');

        if (NotificationManager && NotificationManager.showNotification) {
            NotificationManager.showNotification(`Failed to attach ${name}`, e, 'ERROR');
        } else {
            console.error(`Failed to attach ${name}: ${e}`);
        }
         }); */
    }
}
