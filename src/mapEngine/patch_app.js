const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Add notify function and callbacks
code = code.replace(
  'state: {',
  `onStateChange: null,
  onHoverChange: null,
  _notify() {
    if (this.onStateChange) {
      this.onStateChange({
        path: this.state.selectedPath,
        activeSource: this.state.activeSource,
        activeMode: this.state.activeMode,
        activeBasemap: this.state.activeBasemap,
        activeOverlay: this.state.activeOverlay,
        loading: this.state._drilling,
        panelState: this.state.panelState,
        lastViewed: this.state.lastViewed,
      });
    }
  },
  state: {`
);

// Inject _notify() calls where state changes
code = code.replace(/this\.state\.activeSource = src;/g, "this.state.activeSource = src; this._notify();");
code = code.replace(/this\.state\.selectedPath\.push\(\{ level: this\.state\.currentLevel, feature, name \}\);/g, "this.state.selectedPath.push({ level: this.state.currentLevel, feature, name }); this._notify();");
code = code.replace(/this\.state\.selectedPath\.length = Math\.max\(0, level\);/g, "this.state.selectedPath.length = Math.max(0, level); this._notify();");
code = code.replace(/this\.state\.activeBasemap = key;/g, "this.state.activeBasemap = key; this._notify();");
code = code.replace(/this\.state\.activeMode = mode;/g, "this.state.activeMode = mode; this._notify();");
code = code.replace(/this\.state\.activeOverlay = level;/g, "this.state.activeOverlay = level; this._notify();");

code = code.replace(/this\.state\.lastViewed = \{ feature, level \};/g, "this.state.lastViewed = { feature, level }; this._notify();");
code = code.replace(/this\.state\.panelState = 'closed';/g, "this.state.panelState = 'closed'; this._notify();");
code = code.replace(/this\.state\.panelState = 'open';/g, "this.state.panelState = 'open'; this._notify();");

// Intercept hover
code = code.replace(
  /const lbl = document\.getElementById\('map-hover-label'\);\n\s*if \(\!lbl\) return;/g,
  `if (this.onHoverChange) {
      if (arguments.length === 3) this.onHoverChange({ show: true, x: arguments[0].originalEvent.pageX + 15, y: arguments[0].originalEvent.pageY + 15, name: arguments[1], level: arguments[2] });
      else if (arguments.length === 1) this.onHoverChange({ move: true, x: arguments[0].originalEvent.pageX + 15, y: arguments[0].originalEvent.pageY + 15 });
      else this.onHoverChange(null);
    }
    const lbl = document.getElementById('map-hover-label');
    if (!lbl) return;`
);

fs.writeFileSync('app.js', code);
console.log('patched app.js');
