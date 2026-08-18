import { Chat } from './Chat';
import { File, ProcessBuilder, System, Toolkit, globalAssetsDir } from './Constants';

const MessageType = java.awt.TrayIcon.MessageType;
const SystemTray = java.awt.SystemTray;
const TrayIcon = java.awt.TrayIcon;

class AlertManager {
    constructor() {
        this.trayIcon = null;
        this.appName = 'V5 Client';
        this.setupTray();

        register('gameUnload', () => this.cleanup());
    }

    setupTray() {
        if (!System.getProperty('os.name').toLowerCase().includes('win')) return;

        try {
            const tray = SystemTray.getSystemTray();
            const existingIcon = Array.from(tray.getTrayIcons()).find((icon) => icon.getToolTip() === this.appName);

            if (existingIcon) {
                this.trayIcon = existingIcon;
                return;
            }

            const iconPath = new File(globalAssetsDir, 'icon.png').getPath();
            const img = Toolkit.getDefaultToolkit().createImage(iconPath);

            this.trayIcon = new TrayIcon(img, this.appName);
            this.trayIcon.setImageAutoSize(true);
            this.trayIcon.setToolTip(this.appName);
            tray.add(this.trayIcon);
        } catch (e) {
            Chat.messageDebug('Desktop tray initialization failed: ' + e);
            console.error(e);
        }
    }

    cleanup() {
        if (!this.trayIcon) return;

        try {
            SystemTray.getSystemTray().remove(this.trayIcon);
        } catch (e) {
            Chat.messageDebug('Tray cleanup failed: ' + e);
            console.error(e);
        }
        this.trayIcon = null;
    }

    dispatch(content) {
        const platform = System.getProperty('os.name').toLowerCase();

        if (platform.includes('win')) this.sendWin(content);
        else if (platform.includes('mac')) this.sendMac(content);
        else if (platform.includes('nix') || platform.includes('nux')) this.sendLinux(content);
    }

    sendWin(msg) {
        if (this.trayIcon) this.trayIcon.displayMessage(this.appName, msg, MessageType.WARNING);
    }

    sendMac(msg) {
        const safeMsg = String(msg).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const safeTitle = String(this.appName).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        this.runCmd(['/usr/bin/osascript', '-e', `display notification "${safeMsg}" with title "${safeTitle}"`]);
    }

    sendLinux(msg) {
        this.runCmd(['notify-send', '-u', 'critical', '-a', this.appName, msg]);
    }

    runCmd(args) {
        try {
            new ProcessBuilder(args.map(String)).start();
        } catch (e) {
            Chat.messageDebug('Notification command failed: ' + e);
            console.error(e);
        }
    }
}

const manager = new AlertManager();

export const Notifications = {
    sendAlert: (msg) => manager.dispatch(msg),
};
