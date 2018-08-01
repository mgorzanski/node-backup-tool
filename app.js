const fs = require('fs');
const config = require('./config.json');

const backupDir = config['backupDir'];
const dirsToMakeCopyOf = config['dirsToMakeCopyOf']

let filesIndex = [];

dirsToMakeCopyOf.forEach(dir => {
  const temp = makeTree(dir);
  filesIndex = filesIndex.concat(temp);
});

function makeTree(dir) {
  const tree = [];
  const listing = fs.readdirSync(dir);
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
      const treeElement = {
        path: dir + "\\" + element,
        content: makeTree(dir + "\\" + element)
      };
      tree.push(treeElement);
    }
  });
  return tree;
}

// console.log(makeTree(dirsToMakeCopyOf[1]));

//console.log(filesIndex);
fs.writeFileSync("filesIndex.json", JSON.stringify(filesIndex, null, 2));