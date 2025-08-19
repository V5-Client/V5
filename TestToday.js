import { TrackTime } from "./Utility/TimeTracker";

register("command", (arg) => {
  const moduleName = "testModule";
  if (arg === "start") {
    TrackTime.start(moduleName);
  } else if (arg === "stop") {
    TrackTime.end(moduleName, { info: "Commission Completed" });
  } else {
    ChatLib.chat("bad usage");
  }
}).setName("ttest");


