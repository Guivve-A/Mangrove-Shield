const fs = require("fs");
const path = require("path");

const cache = new Map();

function loadJson(relativePath) {
  const absolutePath = path.resolve(__dirname, "..", relativePath);
  if (cache.has(absolutePath)) {
    return cache.get(absolutePath);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(content);
  cache.set(absolutePath, parsed);
  return parsed;
}

function clearDataCache() {
  cache.clear();
}

module.exports = {
  loadJson,
  clearDataCache,
};