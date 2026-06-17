const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Inject _notify() calls
code = code.replace(/this\.state\.activeSource = src;/g, "this.state.activeSource = src;\n    this._notify();");
code = code.replace(/this\.state\.selectedPath\.push\(\{ level: this\.state\.currentLevel, feature, name \}\);/g, "this.state.selectedPath.push({ level: this.state.currentLevel, feature, name });\n    this._notify();");
code = code.replace(/this\.state\.selectedPath\.length = Math\.max\(0, level\);/g, "this.state.selectedPath.length = Math.max(0, level);\n    this._notify();");
code = code.replace(/this\.state\.activeBasemap = key;/g, "this.state.activeBasemap = key;\n    this._notify();");
code = code.replace(/this\.state\.activeMode = mode;/g, "this.state.activeMode = mode;\n    this._notify();");
code = code.replace(/this\.state\.activeOutline = level;/g, "this.state.activeOutline = level;\n    this._notify();");
code = code.replace(/this\.state\.lastViewed = \{ feature, level \};/g, "this.state.lastViewed = { feature, level };\n    this._notify();");
code = code.replace(/this\.state\.panelState = 'closed';/g, "this.state.panelState = 'closed';\n    this._notify();");
code = code.replace(/this\.state\.panelState = 'open';/g, "this.state.panelState = 'open';\n    this._notify();");

fs.writeFileSync('app.js', code);
console.log('injected _notify calls');
