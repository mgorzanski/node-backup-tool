const fs = require('fs');
const config = require('./config.json');

const backupDir = config['backupDir'];
const dirsToMakeCopyOf = config['dirsToMakeCopyOf']

let filesIndex = []; //main tree of files and catalogs
const allFolders = []; //all folders in main tree

dirsToMakeCopyOf.forEach(dir => {
  if (allFolders.indexOf(dir) === -1) { //check for folder duplicates
    const temp = makeTree(dir);
    filesIndex = filesIndex.concat(temp);
  }
});

function makeTree(dir) {
  let tree = [];
  const listing = fs.readdirSync(dir);
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

fs.writeFileSync("filesIndex.json", JSON.stringify(filesIndex, null, 2)); //save to json file using 2 space indentation