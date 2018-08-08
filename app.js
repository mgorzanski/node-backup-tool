/**
 * @fileOverview The backup tool.
 * @author <a href="mailto:gorzanski.mateusz@gmail.com">Mateusz Górzański</a>
 * @version 0.2.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const _cliProgress = require("cli-progress");

const App = {
  config: {},
  filesIndex: [], //main tree of files and catalogs
  allFolders: [], //all folders in main tree
  filesToCopy: [], //create array of files to copy
  filesToDelete: [],
  fullBackupDir: "",
  backupName: "",
  progressBar: new _cliProgress.Bar(
    {
      format: "Progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}"
    },
    _cliProgress.Presets.shades_classic
  ) //global progress bar, there is no reason to create more than one
};

App.init = function() {
  //check if config file exists
  try {
    this.logMessage(`Loading config file...`);
    //assign config values (don't need to use JSON.parse)
    this.config = require("./config.json");
  } catch (error) {
    this.logErrorMessage(`Error. The config file propably doesn't exist...`);
    process.exit();
  }

  this.buildIndex();
  // if app was executed with --build-index-only parameter
  if (process.argv[2] === "--build-index-only") {
    this.saveIndex();
    process.exit();
  }
  // if app was executed with overwritePreviousBackups option turned on
  if (this.config.overwritePreviousBackups) this.lookForPreviousBackup();
  this.prepareBackup();
  if (this.config.overwritePreviousBackups) this.deleteFiles();
  this.copyFiles();
  this.saveIndex();
};

App.logSuccessMessage = message => console.log(`\x1b[32m`, message, `\x1b[0m`);

App.logErrorMessage = message => console.error(`\x1b[31m`, message, `\x1b[0m`);

App.logMessage = message => console.log(message);

/**
 * Generate files tree, by providing path to a directory
 * @param {string} dir Path to a directory to make tree of
 * @returns {string[]} Returns an array of all files and directories
 */
App.makeTree = function(dir) {
  let tree = [];
  let listing;

  try {
    listing = fs.readdirSync(dir);
  } catch (error) {
    this.logErrorMessage(
      `Error. Cannot read folder contents. Folder ${dir} doesn't exist or there is no permissions to access it... The process has been terminated.`
    );
    process.exit();
  }

  this.allFolders.push(dir);

  listing.forEach(element => {
    const isFile = fs.statSync(dir + path.sep + element).isFile();
    if (isFile) {
      const fileStats = fs.statSync(dir + path.sep + element);
      tree.push({
        path: dir + path.sep + element,
        size: fileStats.size,
        modified: fileStats.mtimeMs
      });
    } else {
      const branch = this.makeTree(dir + path.sep + element);
      tree = tree.concat(branch);
      this.allFolders.push(dir + path.sep + element);
    }
  });

  return tree;
};

/**
 * Generate a name for a new backup
 * @returns {string}
 */
App.generateBackupName = function() {
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
};

App.buildIndex = function() {
  this.logMessage(`Starting to build index...`);
  this.progressBar.start(this.config.dirsToMakeCopyOf.length, 0);

  this.config.dirsToMakeCopyOf.forEach(dir => {
    if (this.allFolders.indexOf(dir) === -1) {
      //check for folder duplicates
      const temp = this.makeTree(dir);
      this.filesIndex = this.filesIndex.concat(temp);
    }
    this.progressBar.increment();
  });

  this.progressBar.stop();

  this.logSuccessMessage(
    `Finished building index. The index contains ${
      this.filesIndex.length
    } files.`
  );
};

App.saveIndex = function() {
  this.logMessage(`Saving index to filesIndex.json...`);

  try {
    fs.writeFileSync(
      "filesIndex.json",
      JSON.stringify(this.filesIndex, null, 2)
    ); //save to json file using 2 space indentation
  } catch (error) {
    this.logErrorMessage(`Error. Cannot write changes to filesIndex.json...`);
  }

  this.logMessage(`Finished saving index.`);
};

App.lookForPreviousBackup = function() {
  this.logMessage(`Looking for old index file...`);
  // Check for last filesIndex.json
  if (fs.existsSync("filesIndex.json")) {
    let previousFilesIndex = fs.readFileSync("filesIndex.json");
    previousFilesIndex = JSON.parse(previousFilesIndex);

    this.filesIndex.forEach(file => {
      const previousFilesIndexElementIndex = previousFilesIndex.findIndex(
        x => x.path === file.path
      );
      if (previousFilesIndexElementIndex !== -1) {
        if (
          previousFilesIndex[previousFilesIndexElementIndex].size < file.size ||
          previousFilesIndex[previousFilesIndexElementIndex].modified <
            file.modified
        ) {
          this.filesToCopy.push(file);
          this.filesToDelete.push(
            previousFilesIndex[previousFilesIndexElementIndex]
          );
        }
        previousFilesIndex.splice(previousFilesIndexElementIndex, 1);
      } else {
        this.filesToCopy.push(file);
      }
    });

    this.filesToDelete = this.filesToDelete.concat(previousFilesIndex);
  } else {
    this.logMessage(`No previous backups found.`);
  }
};

App.prepareBackup = function() {
  this.logMessage(`Starting to make a backup...`);

  this.backupName = this.generateBackupName();
  this.fullBackupDir = this.config.backupDir + path.sep + this.backupName;

  if (this.config.overwritePreviousBackups) {
    const previousBackups = fs.readdirSync(this.config.backupDir);
    let latestBackupDate, latestBackupName;

    // If there is any previous backup in backup directory
    if (previousBackups.length) {
      previousBackups.forEach(backup => {
        const backupStats = fs.statSync(
          this.config.backupDir + path.sep + backup
        );
        if (
          backupStats.isDirectory() &&
          (!latestBackupDate || latestBackupDate < backupStats.birthtime)
        ) {
          latestBackupDate = backupStats.birthtime;
          latestBackupName = backup;
        }
      });

      // Change backup folder name to the new one
      fs.renameSync(
        this.config.backupDir + path.sep + latestBackupName,
        this.fullBackupDir
      );
    }
  } else {
    try {
      fs.mkdirSync(this.fullBackupDir);
    } catch (error) {
      this.logErrorMessage(
        `Error. Cannot create a backup folder... This might be a permission issue. The process has been terminated.`
      );
    }
  }
};

App.deleteFiles = function() {
  this.logMessage(
    `Starting to delete old version of files and files that aren't now included in backup...`
  );

  this.progressBar.start(this.filesToDelete.length, 0);
  let foldersToDelete = [];

  this.filesToDelete.forEach(file => {
    file = this.fullBackupDir + path.sep + file.path.replace(/:/, "");
    fs.unlinkSync(file);
    foldersToDelete.push(path.dirname(file));
    this.progressBar.increment();
  });

  foldersToDelete = foldersToDelete.filter((item, pos) => {
    return foldersToDelete.indexOf(item) === pos;
  });

  foldersToDelete.reverse();

  foldersToDelete.forEach(folder => {
    if (fs.existsSync(folder)) {
      fs.rmdirParentSync(folder);
    }
  });

  this.progressBar.stop();

  this.logSuccessMessage(`Deleted old files successfully.`);
};

App.copyFiles = function() {
  this.logMessage(`Starting to copy files...`);

  this.progressBar.start(this.filesToCopy.length, 0);

  this.filesToCopy.forEach(file => {
    const newPath = this.fullBackupDir + path.sep + file.path.replace(/:/, "");
    const newDirPath = path.dirname(newPath); //removes filename from path

    //this try/catch is needed, because if mkdirParentSync function is called directly it can try to create a folder that already exists, so catch is fired and then the recursion is happening which causes call stack limit error, because it is going upper and upper and never ends
    try {
      fs.accessSync(newDirPath);
    } catch (error) {
      fs.mkdirParentSync(newDirPath);
    }

    try {
      fs.copyFileSync(file.path, newPath);
    } catch (error) {
      this.logErrorMessage(
        `An error occurred when script was trying to copy a file from: ${
          file.path
        }. The process has been terminated.`
      );
      process.exit();
    }

    this.progressBar.increment();
  });

  this.progressBar.stop();

  this.logSuccessMessage(
    `Backup has been successfully finished! You can find it here: ${
      this.fullBackupDir
    }.`
  );
};

/**
 * Create recursively directories for a specified path
 * @param {string[]} dirPath Path to new directory
 * @param {number} mode
 * @returns {string[]} Returns an array of all files and directories
 */
fs.mkdirParentSync = function(dirPath, mode) {
  try {
    fs.mkdirSync(dirPath, mode);
  } catch (error) {
    fs.mkdirParentSync(path.dirname(dirPath), mode); //every time function is called the folder is one upper (path.dirname removes last directory)
    fs.mkdirParentSync(dirPath, mode); //after creating the most upper folder, function is called again and now mkdirSync is doing a job
  }
};

fs.rmdirParentSync = function(dirPath, mode) {
  try {
    fs.rmdirSync(dirPath, mode);
  } catch (error) {
    fs.rmdirParentSync(path.dirname(dirPath), mode);
    fs.rmdirParentSync(dirPath, mode);
  }
};

App.init();
