const fs = require('fs');
let content = fs.readFileSync('src/lib/dashboard.js', 'utf8');
const descs = JSON.parse(fs.readFileSync('muni_descs.json', 'utf8'));

const startIdx = content.indexOf('const BOUNDARY_OVERVIEWS = {');
const endIdx = content.indexOf('};', startIdx) + 2;

let newDict = 'const BOUNDARY_OVERVIEWS = {\n';
const baseStr = content.substring(startIdx + 'const BOUNDARY_OVERVIEWS = {'.length, endIdx - 2).trim();
newDict += '  ' + baseStr + ',\n';

const keys = Object.keys(descs);
keys.forEach((k, i) => {
  newDict += `  "${k}": "${descs[k].replace(/"/g, '\\"')}"`;
  if (i < keys.length - 1) newDict += ',\n';
});
newDict += '\n};';

content = content.substring(0, startIdx) + newDict + content.substring(endIdx);
fs.writeFileSync('src/lib/dashboard.js', content);
console.log('Successfully injected descriptions!');
