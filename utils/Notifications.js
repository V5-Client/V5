import { Toolkit, System, MessageType, SystemTray, TrayIcon } from './Constants';
import { Chat } from './Chat';

class AlertManager {
    constructor() {
        this.trayIcon = null;
        this.appName = 'V5 Client';
        this.setupTray();
    }

    setupTray() {
        if (!System.getProperty('os.name').toLowerCase().includes('win')) return;

        try {
            const tray = SystemTray.getSystemTray();
            const existingIcons = tray.getTrayIcons();
            
            for (var i = 0; i < existingIcons.length; i++) {
                if (existingIcons[i].getToolTip() === this.appName) {
                    this.trayIcon = existingIcons[i];
                    return;
                }
            }

            const iconPath = './config/ChatTriggers/assets/icon.png';
            const img = Toolkit.getDefaultToolkit().createImage(iconPath);
            
            this.trayIcon = new TrayIcon(img, this.appName);
            this.trayIcon.setImageAutoSize(true);
            this.trayIcon.setToolTip(this.appName);
            tray.add(this.trayIcon);
        } catch (err) {
            Chat.messageDebug('Desktop tray initialization failed: ' + err);
        }
    }

    dispatch(content) {
        const platform = System.getProperty('os.name').toLowerCase();
        
        if (platform.includes('win')) {
            this.sendWin(content);
        } else if (platform.includes('mac')) {
            this.sendMac(content);
        } else if (platform.includes('nix') || platform.includes('nux')) {
            this.sendNix(content);
        }
    }

    sendWin(msg) {
        if (this.trayIcon) {
            this.trayIcon.displayMessage(this.appName, msg, MessageType.WARNING);
        }
    }

    sendMac(msg) {
        this.runCmd(['/usr/bin/osascript', '-e', `display notification "${msg}" with title "${this.appName}"`]);
    }

    sendNix(msg) {
        this.runCmd(['notify-send', '-u', 'critical', '-a', this.appName, msg]);
    }

    runCmd(args) {
        try {
            const pb = new java.lang.ProcessBuilder(args.map(String));
            pb.start();
        } catch (e) {}
    }
}

const manager = new AlertManager();

export const Notifications = {
    sendAlert: (msg) => manager.dispatch(msg)
};
