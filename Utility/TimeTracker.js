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

  start(moduleName) {
    if (!moduleName) {
      Prefix.message("&cTrackTime.start() requires a moduleName.");
      return false;
    }
    try {
      const data = this.readData();
      const sessions = data.sessions;
      const runningSession = sessions.find((s) => s.moduleName === moduleName && s.end === null);
      if (runningSession) {
        Prefix.debugMessage(`&eTrackTime.start(): session for ${moduleName} already running`);
        return false;
      }
      sessions.push({ moduleName, start: Date.now(), end: null, extraData: null });
      this.writeData(data);
      Prefix.message(`&aTime tracking started for ${moduleName}.`);
      return true;
    } catch (e) {
      Prefix.message("&cFailed to start tracking: " + e);
      return false;
    }
  }

  end(moduleName, extraData = null) {
    if (!moduleName) {
      Prefix.message("&cTrackTime.end() requires a moduleName.");
      return false;
    }
    try {
      const data = this.readData();
      const sessions = data.sessions;

      let runningSessionIndex = -1;
      for (let i = sessions.length - 1; i >= 0; i--) {
        if (sessions[i].moduleName === moduleName && sessions[i].end === null) {
          runningSessionIndex = i;
          break;
        }
      }

      if (runningSessionIndex === -1) {
        Prefix.debugMessage(`&eTrackTime.end(): no running session for ${moduleName}`);
        return false;
      }

      const session = sessions[runningSessionIndex];
      const endTime = Date.now();
      const duration = endTime - session.start;

      if (duration < 60000) {
        sessions.splice(runningSessionIndex, 1); // Remove the session
        this.writeData(data);
        Prefix.message("&eSession was shorter than 60 seconds and was not saved.");
        return true; 
      }

      session.end = endTime;
      session.extraData = extraData;
      this.writeData(data);
      Prefix.message(`&aTime tracking stopped for ${moduleName}.`);
      return true;
    } catch (e) {
      Prefix.message("&cFailed to stop tracking: " + e);
      return false;
    }
  }
}

export const TrackTime = new TimeTrackerService();


