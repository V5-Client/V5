import { Utils } from "./Utils";
import { Prefix } from "./Prefix";

class TimeTrackerService {
  constructor() {
    this.fileName = "today.json";
  }

  readData() {
    const data = Utils.getConfigFile(this.fileName) || {};
    if (!data.sessions || !Array.isArray(data.sessions)) {
      data.sessions = [];
    }
    return data;
  }

  writeData(data) {
    Utils.writeConfigFile(this.fileName, data);
  }

  start() {
    try {
      const data = this.readData();
      const sessions = data.sessions;
      const lastSession = sessions[sessions.length - 1];
      if (lastSession && lastSession.end == null) {
        Prefix.debugMessage("&eTrackTime.start(): session already running");
        return false;
      }
      sessions.push({ start: Date.now(), end: null });
      this.writeData(data);
      Prefix.message("&aTime tracking started.");
      return true;
    } catch (e) {
      Prefix.message("&cFailed to start tracking: " + e);
      return false;
    }
  }

  stop() {
    try {
      const data = this.readData();
      const sessions = data.sessions;
      const lastSession = sessions[sessions.length - 1];
      if (!lastSession || lastSession.end != null) {
        Prefix.debugMessage("&eTrackTime.stop(): no running session");
        return false;
      }
      lastSession.end = Date.now();
      this.writeData(data);
      Prefix.message("&aTime tracking stopped.");
      return true;
    } catch (e) {
      Prefix.message("&cFailed to stop tracking: " + e);
      return false;
    }
  }

  toggle() {
    try {
      const data = this.readData();
      const sessions = data.sessions;
      const lastSession = sessions[sessions.length - 1];
      if (lastSession && lastSession.end == null) {
        return this.stop();
      } else {
        return this.start();
      }
    } catch (e) {
      Prefix.message("&cFailed to toggle tracking: " + e);
      return false;
    }
  }
}

export const TrackTime = new TimeTrackerService();


