const VALID_NOTIFICATION_TYPES = ["SUCCESS", "CHECK-IN", "INFO", "WARNING", "ERROR", "DANGER"];

register("command", (...args) => { 
  if (!args || args.length === 0) {
    ChatLib.chat("&aShowing all notification types...");
    const showcaseMessages = {
      "SUCCESS": { title: "Success!", description: "It was a success!" },
      "CHECK-IN": { title: "Check In", description: "Are you attending?" },
      "INFO": { title: "Information", description: "A new update is available. Also, this is a test of the word wrap feature." },
      "WARNING": { title: "System Warning", description: "You're lagging, be cautious" },
      "ERROR": { title: "Error Occurred", description: "Failed to save settings or something" },
      "DANGER": { title: "Critical Failure", description: "GASP, PRETEND SOMETHING HAPPENED!" }
    };

    VALID_NOTIFICATION_TYPES.forEach((type, index) => {
      setTimeout(() => {
        const message = showcaseMessages[type];
        global.showNotification(message.title, message.description, type, 4000 + index * 500); // showcase different durations
      }, index * 1000);
    });

    setTimeout(() => {
      global.showNotification("Sticky Notification", "This one stays until you click the 'X' button.", "INFO", 'sticky');
    }, VALID_NOTIFICATION_TYPES.length * 1000);

    return;
  }
  
  let type = "SUCCESS";
  let duration = undefined;

  const potentialType = args[0]?.toUpperCase();
  if (potentialType && VALID_NOTIFICATION_TYPES.includes(potentialType)) {
    type = potentialType;
    args.shift(); 
  }

  const lastArg = args[args.length - 1];
  if (lastArg) {
    if (lastArg.toLowerCase() === 'sticky') {
      duration = 'sticky';
      args.pop(); 
    } else if (!isNaN(lastArg)) {
      duration = parseInt(lastArg, 10);
      args.pop(); 
    }
  }

  const title = args.shift() || `${type} Title`; 
  const description = args.join(' ') || "This is a sample description."; 

  global.showNotification(title, description, type, duration);

}).setName("testnotify").setAliases("tn");

register("command", () => {
  ChatLib.chat("&a&m" + ChatLib.getChatBreak("-"));
  ChatLib.chat("&aNotification Test Commands:");
  ChatLib.chat("&e/testnotify &7- Shows a sequence of all notification types");
  ChatLib.chat("&e/tn [type] [title] [description...] [duration|sticky]");
  ChatLib.chat("&7- Shows a custom notification. Type and duration are optional.");
  ChatLib.chat("&bAvailable types: &f" + VALID_NOTIFICATION_TYPES.join(", "));
  ChatLib.chat("&7Example 1 (timed): &e/tn warning 'Warning' 'Your failsafe suspiciousness value is high' 10000");
  ChatLib.chat("&7Example 2 (sticky): &e/tn danger 'Alert' 'This is an important message' sticky");
  ChatLib.chat("&7Example 3 (simple): &e/tn 'Hello World'");
  ChatLib.chat("&a&m" + ChatLib.getChatBreak("-"));
}).setName("notifyhelp");