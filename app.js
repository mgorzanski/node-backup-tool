const fs = require("fs");
const path = require("path");

let config;
//check if config file exists
try {
  console.log(`Loading config file...`);
  config = require("./config.json");
} catch (error) {
  console.error(
    `\x1b[31m`,
    `Error. The config file propably doesn't exist...`,
    `\x1b[0m`
  );
  process.exit();
}

const _cliProgress = require("cli-progress");

//assign config values to consts (don't need to use JSON.parse)
const {
  backupDir,
  dirsToMakeCopyOf,
  overwritePreviousBackups,
  useWindowsPathSymbols
} = config;

//functions here
function makeTree(dir) {
  let tree = [];
  let listing;
  try {
    listing = fs.readdirSync(dir);
  } catch (error) {
    console.error(
      `\x1b[31m`,
      `Error. Cannot read folder contents. Folder ${dir} doesn't exist or there is no permissions to access it... The process has been terminated.`,
      `\x1b[0m`
    );
    process.exit();
  }
  allFolders.push(dir);
  listing.forEach(element => {
    const isFile = fs.statSync(dir + "\\" + element).isFile();
    if (isFile) {
      const fileStats = fs.statSync(dir + "\\" + element);
      tree.push({
        path: dir + "\\" + element,
        size: fileStats.size,
        modified: fileStats.mtime
      });
    } else {
      const branch = makeTree(dir + "\\" + element);
      tree = tree.concat(branch);
      allFolders.push(dir + "\\" + element);
    }
  });
  return tree;
}

function generateBackupName() {
  //generate backup date
  const today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth() + 1;
  let yyyy = today.getFullYear();

  if (dd < 10) {
    dd = "0" + dd;
  }

  if (mm < 10) {
    mm = "0" + mm;
  }

  const randomString =
    Math.random()
      .toString(36)
      .substring(2, 15) +
    Math.random()
      .toString(36)
      .substring(2, 15);
  const backupName = `${yyyy}-${mm}-${dd}_${randomString}`;

  return backupName;
}

function mkdirParentSync(dirPath, mode) {
  try {
    fs.mkdirSync(dirPath, mode);
  } catch (error) {
    mkdirParentSync(path.dirname(dirPath), mode); //every time function is called the folder is one upper (path.dirname removes last directory)
    mkdirParentSync(dirPath, mode); //after creating the most upper folder, function is called again and now mkdirSync is doing a job
  }
}
//end functions

let filesIndex = []; //main tree of files and catalogs
const allFolders = []; //all folders in main tree

console.log(`Starting to build index...`);

const progressBar = new _cliProgress.Bar(
  {
    format: "Progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}"
  },
  _cliProgress.Presets.shades_classic
);
progressBar.start(dirsToMakeCopyOf.length, 0);

dirsToMakeCopyOf.forEach(dir => {
  if (allFolders.indexOf(dir) === -1) {
    //check for folder duplicates
    const temp = makeTree(dir);
    filesIndex = filesIndex.concat(temp);
  }
  progressBar.increment();
});

progressBar.stop();

console.log(`Saving index to filesIndex.json...`);

try {
  fs.writeFileSync("filesIndex.json", JSON.stringify(filesIndex, null, 2)); //save to json file using 2 space indentation
} catch (error) {
  console.error(
    `\x1b[31m`,
    `Error. Cannot write changes to filesIndex.json...`,
    `\x1b[0m`
  );
  process.exit();
}

console.log(
  `\x1b[32m`,
  `Finished building index. The index contains ${filesIndex.length} files.`,
  `\x1b[0m`
);

if (process.argv[2] === "--build-index-only") process.exit();

console.log(`Starting to make a backup...`);

const backupName = generateBackupName();
const fullBackupDir = backupDir + "\\" + backupName;

//create folder for a backup
try {
  fs.mkdirSync(fullBackupDir);
} catch (error) {
  console.error(
    `\x1b[31m`,
    `Error. Cannot create a backup folder... This might be a permission issue. The process has been terminated.`,
    `\x1b[0m`
  );
}

//copy files
console.log(`Starting to copy files...`);

progressBar.start(filesIndex.length, 0);

if (!overwritePreviousBackups) {
  filesIndex.forEach(file => {
    const newPath = fullBackupDir + "\\" + file.path.replace(/:/, "");
    const newDirPath = path.dirname(newPath); //removes filename from path

    //this try/catch is needed, because if mkdirParentSync function is called directly it can try to create a folder that already exists, so catch is fired and then the recursion is happening which causes call stack limit error, because it is going upper and upper and never ends
    try {
      fs.accessSync(newDirPath);
    } catch (error) {
      mkdirParentSync(newDirPath);
    }

    try {
      fs.copyFileSync(file.path, newPath);
    } catch (error) {
      console.error(
        `\x1b[31m`,
        `An error occurred when script was trying to copy a file from: ${
          file.path
        }. The process has been terminated.`,
        `\x1b[0m`
      );
      process.exit();
    }

    progressBar.increment();
  });
}

progressBar.stop();

console.log(
  `\x1b[32m`,
  `Backup has been successfully finished! You can find it here: ${fullBackupDir}.`,
  `\x1b[0m`
);
