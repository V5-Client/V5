import { TrackTime } from "./Utility/TimeTracker";

register("command", () => {
  TrackTime.toggle();
}).setName("ttest");


