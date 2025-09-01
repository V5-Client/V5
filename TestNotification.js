const VALID_NOTIFICATION_TYPES = ["SUCCESS", "CHECK-IN", "INFO", "WARNING", "ERROR", "DANGER"];

register("command", (...args) => { 
  if (!args || args.length === 0) {
    ChatLib.chat("&aShowing all notification types...");
    const showcaseMessages = {
      "SUCCESS": { title: "Success!", description: "It was a success!" },
      "CHECK-IN": { title: "Check In", description: "Are you attending?" },
      "INFO": { title: "Information", description: "A new update is available" },
      "WARNING": { title: "System Warning", description: "You're lagging, be cautious" },
      "ERROR": { title: "Error Occurred", description: "Failed to save settings or something" },
      "DANGER": { title: "Critical Failure", description: "GASP, PRETEND SOMETHING HAPPENED!" }
    };

    VALID_NOTIFICATION_TYPES.forEach((type, index) => {
      setTimeout(() => {
        const message = showcaseMessages[type];
        global.showNotification(message.title, message.description, type, 4000 + index * 1000); // showcase different durations
      }, index * 1200);
    });
    return;
  }
  
  // Custom Notification
  let type = "SUCCESS";
  let title = "";
  let description = "";
  let duration = undefined;

  const potentialType = args[0].toUpperCase();

  if (VALID_NOTIFICATION_TYPES.includes(potentialType)) {
    type = potentialType;
    title = args[1] || `${type} Title`;
    description = args.slice(2, -1).join(" ") || "This is a sample description.";

    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg)) {
      duration = parseInt(lastArg);
    }
  } else {
    // Did not specify a type or incorrect type, assume SUCCESS, /tn Title Description [duration]
    type = "SUCCESS";
    title = args[0];
    description = args.slice(1, -1).join(" ") || "This is a sample description.";

    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg)) {
      duration = parseInt(lastArg);
    }
  }

  global.showNotification(title, description, type, duration);

}).setName("testnotify").setAliases("tn");

register("command", () => {
  ChatLib.chat("&a&m" + ChatLib.getChatBreak("-"));
  ChatLib.chat("&aNotification Test Commands:");
  ChatLib.chat("&e/testnotify &7- Shows a sequence of all notification types");
  ChatLib.chat("&e/testnotify [type] [title] [description] [duration] &7- Custom notification");
  ChatLib.chat("&bAvailable types: &f" + VALID_NOTIFICATION_TYPES.join(", "));
  ChatLib.chat("&7Example: &e/tn warning Low FPS 10000");
  ChatLib.chat("&a&m" + ChatLib.getChatBreak("-"));
}).setName("notifyhelp");
