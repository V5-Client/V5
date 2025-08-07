import { Prefix } from "./Prefix";
let File = Java.type("java.io.File");

let configName = "ClientConfig";

function existsFile(configName, FileName) {
  return FileLib.exists(configName, FileName);
}

function deleteFile(configName, FileName) {
  FileLib.delete(configName, FileName);
}

function fileBroken(configName, FileName) {
  let config = FileLib.read(configName, FileName);
  if (FileName === "responseMessages.txt") {
    return;
  }
  try {
    JSON.parse(config);
  } catch (error) {
    chat.message("Replaced corrupted file: " + FileName);
    deleteFile(configName, FileName);
    return true;
  }
  return false;
}

function makeDir(Name) {
  let dir = new File("./config/ChatTriggers/modules/" + configName, Name);
  dir.mkdir();
}

function makeFile(Path, Content) {
  FileLib.append(configName, Path, Content);
}

// Makes the base folder
if (!existsFile("./config/ChatTriggers/modules", configName)) {
  let dir = new File("./config/ChatTriggers/modules/", configName);
  dir.mkdir();
}

let Files = [
  // Base Files
  {
    path: "config.json",
    FileType: "file",
    Content: [],
  },
  {
    path: "keybinds.json",
    FileType: "file",
    Content: [],
  },
  {
    path: "dev.json",
    FileType: "file",
    Content: [],
  },
  {
    path: "webhook.json",
    FileType: "file",
    Content: [],
  },
  {
    path: "responseMessages.txt",
    FileType: "text",
    Content: [
      "???",
      "bro wtf",
      "what",
      "rly",
      "hmmmm",
      "bro",
      "?",
      "hello??",
      "lol",
      "nice bro",
      "...",
      "omg",
      "pls",
      "lmfao",
      "idiot",
      "really",
    ],
  },

  // Routes

  {
    path: "gemstoneroutes",
    FileType: "dir",
  },
  { path: "gemstoneroutes/empty.txt", FileType: "file", Content: [] },

  {
    path: "routewalkerroutes",
    FileType: "dir",
  },
  { path: "routewalkerroutes/empty.txt", FileType: "file", Content: [] },

  {
    path: "tunnelroutes",
    FileType: "dir",
  },
  { path: "tunnelroutes/empty.txt", FileType: "file", Content: [] },

  {
    path: "oreroutes",
    FileType: "dir",
  },
  { path: "oreroutes/empty.txt", FileType: "file", Content: [] },

  {
    path: "etherwarperoutes",
    FileType: "dir",
  },
  { path: "etherwarperoutes/empty.txt", FileType: "file", Content: [] },

  // Mining Speed
  { path: "miningspeed.json", FileType: "file", Content: {} },
];

// Handles all the extra files
Files.forEach((FileData) => {
  if (
    !existsFile(configName, FileData.path) ||
    fileBroken(configName, FileData.path)
  ) {
    if (FileData.FileType === "file") {
      makeFile(FileData.path, JSON.stringify(FileData.Content, null, 2));
    }
    if (FileData.FileType === "text") {
      makeFile(FileData.path, FileData.Content.join("\n"));
    }
    if (FileData.FileType === "dir") {
      makeDir(FileData.path);
    }
  }
});
