const fs = require('fs');

let config;
//check if config file exists
try {
  console.log(`Loading config file...`);
  config = require('./config.json');
} catch (error) {
  console.error(`Error. The config file propably doesn't exist...`)
  process.exit();
}

//parse json config to object and assign values to consts
const { backupDir, dirsToMakeCopyOf, overwritePreviousBackups, useWindowsPathSymbols } = JSON.parse(config);

let filesIndex = []; //main tree of files and catalogs
const allFolders = []; //all folders in main tree

console.log(`Starting to build index...`);
dirsToMakeCopyOf.forEach(dir => {
  if (allFolders.indexOf(dir) === -1) { //check for folder duplicates
    const temp = makeTree(dir);
    filesIndex = filesIndex.concat(temp);
  }
});

function makeTree(dir) {
  let tree = [];
  let listing;
  try {
    listing = fs.readdirSync(dir);
  } catch (error) {
    console.error(`Error. Cannot read folder contents. Folder ${dir} doesn't exist or there is no permissions to access it... The process has been terminated.`);
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

console.log(`Saving index to filesIndex.json...`);

try {
  fs.writeFileSync("filesIndex.json", JSON.stringify(filesIndex, null, 2)); //save to json file using 2 space indentation
} catch (error) {
  console.error(`Error. Cannot write changes to filesIndex.json...`);
  process.exit();
}

console.log(`Finished building index. The index contains ${filesIndex.length} files.`);
console.log(`Starting to make a backup...`);

function generateBackupName() {
  //generate backup date
  const today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth() + 1;
  let yyyy = today.getFullYear();

  if(dd < 10) {
    dd = '0'+dd;
  }

  if(mm < 10) {
    mm = '0'+mm;
  }

  const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const backupName = `${yyyy}-${mm}-${dd}_${randomString}`;

  return backupName;
}

const backupName = generateBackupName();

//create folder for a backup
try {
  fs.mkdirSync(backupDir + "\\" + backupName);
} catch (error) {
  console.error(`Error. Cannot create a backup folder... This might be a permission issue. The process has been terminated.`);
}

