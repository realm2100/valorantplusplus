const fs = require('fs');

const readFile = (path) => {
  return new Promise((resolve, reject) => {
    try {
      const data = fs.readFileSync(path.replace('$LOCALAPPDATA', process.env.LOCALAPPDATA), {
        encoding: 'UTF-8'
      });
      resolve(data);
    } catch (e) {
      reject(e.code);
    }
  });
};

module.exports = {
  readFile: readFile,
  write: write
};
