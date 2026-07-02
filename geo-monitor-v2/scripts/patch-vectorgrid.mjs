
/**
 * Patches leaflet.vectorgrid's bundled PBF decoder to handle protobuf
 * wire types 3 (start group) and 4 (end group) instead of throwing
 * "Unimplemented type".
 *
 * MVT v2 tiles may contain these wire types for unknown/optional fields.
 * The old pbf decoder (~3.0) shipped with leaflet.vectorgrid 1.3.0
 * does not handle them; this patch adds that support.
 *
 * Runs as a postinstall hook so it survives `npm install`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'node_modules', 'leaflet.vectorgrid', 'dist');

const NEW_SKIP_DEV = `    skip: function(val) {
        var type = val & 0x7;
        if (type === Pbf.Varint) { while (this.buf[this.pos++] > 0x7f) {} }
        else if (type === Pbf.Bytes) { this.pos = this.readVarint() + this.pos; }
        else if (type === Pbf.Fixed32) { this.pos += 4; }
        else if (type === Pbf.Fixed64) { this.pos += 8; }
        else if (type === 3) { /* start group -- skip until matching end group */ var depth = 1; while (depth > 0 && this.pos < this.length) { var v = this.readVarint(); var t = v & 0x7; if (t === 4) { depth--; } else if (t === 3) { depth++; } else { if (t === 0) { while (this.buf[this.pos++] > 0x7f) {} } else if (t === 2) { this.pos = this.readVarint() + this.pos; } else if (t === 5) { this.pos += 4; } else if (t === 1) { this.pos += 8; } } } }
        else if (type === 4) { /* end group -- ignore */ }
        else { throw new Error('Unimplemented type: ' + type); }
    },`;

const OLD_SKIP_DEV = `    skip: function(val) {
        var type = val & 0x7;
        if (type === Pbf.Varint) { while (this.buf[this.pos++] > 0x7f) {} }
        else if (type === Pbf.Bytes) { this.pos = this.readVarint() + this.pos; }
        else if (type === Pbf.Fixed32) { this.pos += 4; }
        else if (type === Pbf.Fixed64) { this.pos += 8; }
        else { throw new Error('Unimplemented type: ' + type); }
    },`;

// Inline skipping (no temp function) to avoid confusing rolldown's parser
const NEW_SKIP_MIN = 'skip:function(t){var e=7&t;if(e===Pbf.Varint)for(;this.buf[this.pos++]>127;);else if(e===Pbf.Bytes)this.pos=this.readVarint()+this.pos;else if(e===Pbf.Fixed32)this.pos+=4;else if(e===Pbf.Fixed64)this.pos+=8;else if(e===3){for(var d=1;d>0&&this.pos<this.length;){var v=this.readVarint(),vt=7&v;if(vt===4)d--;else if(vt===3)d++;else if(vt===0)for(;this.buf[this.pos++]>127;);else if(vt===2)this.pos=this.readVarint()+this.pos;else if(vt===5)this.pos+=4;else if(vt===1)this.pos+=8}}else if(e===4){}else throw new Error("Unimplemented type: "+e)}';

const OLD_SKIP_MIN_BUNDLED = 'skip:function(t){var e=7&t;if(e===Pbf.Varint)for(;this.buf[this.pos++]>127;);else if(e===Pbf.Bytes)this.pos=this.readVarint()+this.pos;else if(e===Pbf.Fixed32)this.pos+=4;else{if(e!==Pbf.Fixed64)throw new Error("Unimplemented type: "+e);this.pos+=8}';

const OLD_SKIP_MIN_UNBUNDLED = 'skip:function(t){var e=7&t;if(e===Pbf.Varint)for(;this.buf[this.pos++]>127;);else if(e===Pbf.Bytes)this.pos=this.readVarint()+this.pos;else if(e===Pbf.Fixed32)this.pos+=4;else{if(e!==Pbf.Fixed64)throw new Error("Unimplemented type: "+e);this.pos+=8}';

let patched = 0;

function tryPatch(filePath, oldStr, newStr, label) {
  try {
    const content = readFileSync(filePath, 'utf8');
    if (content.includes(newStr)) {
      console.log(`  Already patched: ${label}`);
      return;
    }
    if (content.includes(oldStr)) {
      writeFileSync(filePath, content.replace(oldStr, newStr), 'utf8');
      console.log(`\u2713 Patched ${label}`);
      patched++;
    } else {
      if (content.includes('else if(e===3)') || content.includes('else if (type === 3')) {
        console.log(`  Already patched (type 3 found): ${label}`);
      } else {
        console.warn(`  ! Pattern not found in ${label} -- may have different version: ${filePath}`);
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`  ! File not found: ${label}`);
    } else {
      console.error(`  ! Error patching ${label}:`, err.message);
    }
  }
}

// bundled, unminified
tryPatch(join(DIST, 'Leaflet.VectorGrid.bundled.js'), OLD_SKIP_DEV, NEW_SKIP_DEV, 'Leaflet.VectorGrid.bundled.js');
// bundled, minified (entry point used by Vite)
tryPatch(join(DIST, 'Leaflet.VectorGrid.bundled.min.js'), OLD_SKIP_MIN_BUNDLED, NEW_SKIP_MIN, 'Leaflet.VectorGrid.bundled.min.js');
// unbundled, unminified
tryPatch(join(DIST, 'Leaflet.VectorGrid.js'), OLD_SKIP_DEV, NEW_SKIP_DEV, 'Leaflet.VectorGrid.js');
// unbundled, minified
tryPatch(join(DIST, 'Leaflet.VectorGrid.min.js'), OLD_SKIP_MIN_UNBUNDLED, NEW_SKIP_MIN, 'Leaflet.VectorGrid.min.js');

console.log(`\nPatched ${patched} file(s).`);

// Validate brace balance in minified files
for (const f of ['Leaflet.VectorGrid.bundled.min.js', 'Leaflet.VectorGrid.min.js']) {
  try {
    const c = readFileSync(join(DIST, f), 'utf8');
    const opens = (c.match(/\{/g) || []).length;
    const closes = (c.match(/\}/g) || []).length;
    if (opens !== closes) {
      console.error(`  ! BRACE MISMATCH in ${f}: ${opens} opens, ${closes} closes`);
      process.exitCode = 1;
    }
  } catch {}
}
