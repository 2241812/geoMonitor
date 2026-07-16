#!/usr/bin/env node
/**
 * update-deploy.mjs — GeoJSON/TopoJSON file update & deploy pipeline
 *
 * Drop a .geojson/.topojson/.json file and this tool routes it to the
 * correct subfolder under public/geoJSON/, rebuilds, and deploys via FTP.
 *
 * Modes:
 *   node scripts/update-deploy.mjs <file>           # One-shot: process a single file
 *   node scripts/update-deploy.mjs --watch           # Watcher: monitors gis-drop/ folder
 *   node scripts/update-deploy.mjs --deploy-only     # Build + deploy (no file copy)
 *
 * Flags:
 *   --skip-build   Copy file only, skip build + deploy
 *   --skip-deploy  Build but skip FTP deploy
 */

import { readFile, copyFile, mkdir, rename } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname, relative as relPath } from 'node:path';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const SCRIPT_DIR = import.meta.dirname;
const PROJECT_ROOT = join(SCRIPT_DIR, '..');
const PUBLIC_GEOJSON = join(PROJECT_ROOT, 'public/geoJSON');
const GIS_DROP = join(PROJECT_ROOT, 'gis-drop');
const DEPLOY_SCRIPT = join(SCRIPT_DIR, 'deploy-ftp.mjs');

const POLL_MS = 2000;      /* watcher poll interval */
const STABILITY_MS = 1200; /* wait for file writes to finish */

/* ── Colors ── */
const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  dim: '\x1b[90m',
};

/* ── Basin routing table ── */
const BASIN_MAP = {
  ABR: 'Watersheds/Abra Riverbasin',
  ABU: 'Watersheds/Apayao-Abulug Riverbasin',
  AGN: 'Watersheds/Agno Riverbasin',
  AMB: 'Watersheds/Amburayan River',
  ARI: 'Watersheds/Aringay River',
  BUD: 'Watersheds/Bued River',
  CAB: 'Watersheds/Cabicungan River',
  MLG: 'Watersheds/Mallig River',
  NAG: 'Watersheds/Naguilian River',
  SIF: 'Watersheds/Siffu River',
  SMR: 'Watersheds/Santa Maria River (Silag)',
  UCH: 'Watersheds/Upper Chico Riverbasin',
  UMT: 'Watersheds/Upper Magat River',
  ZUM: 'Watersheds/Zumigui-Ziwanan River',
};

/* ── File routing ── */
function routeFile(filename) {
  const base = basename(filename);

  /* ── Root-level files (directly in public/geoJSON/) ── */
  if (
    base.startsWith('CAR ') ||
    base.startsWith('Slope') ||
    base.startsWith('hierarchy') ||
    base.includes('intersections') ||
    base === 'hierarchy.json'
  ) {
    return '';
  }

  /* ── LCM overlay (land cover per basin) ── */
  if (base.includes('_LCM2025') || base.includes('_LCM')) {
    return 'LCM';
  }

  /* ── Admin overlay tiles ── */
  if (base.startsWith('cad_') || base.startsWith('namria_')) {
    return 'Overlays';
  }

  /* ── Watershed files by 3-letter prefix ── */
  const prefix = base.split('_')[0].toUpperCase();
  if (BASIN_MAP[prefix]) {
    return BASIN_MAP[prefix];
  }

  return null; /* unrecognized — will prompt user */
}

/* ── Validation ── */
function isValidGeoJSON(content) {
  try {
    const data = JSON.parse(content);
    if (!data || typeof data !== 'object') return false;
    const type = data.type;
    return (
      type === 'FeatureCollection' ||
      type === 'Feature' ||
      type === 'Topology' ||
      type === 'GeometryCollection'
    );
  } catch {
    return false;
  }
}

/* ── Logging ── */
function log(level, msg) {
  const prefix = (
    { info: `${C.blue}▸${C.reset}`,
      ok: `${C.green}✓${C.reset}`,
      warn: `${C.yellow}⚠${C.reset}`,
      error: `${C.red}✗${C.reset}`,
      dim: `${C.dim}·${C.reset}`,
    }[level] || ' ');
  console.log(`${prefix} ${msg}`);
}

/* ── Interactive prompt ── */
async function ask(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${C.yellow}?${C.reset} ${query} `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/* ── Sleep ── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── Relative path for display ── */
function shortPath(absPath) {
  const r = relPath(PROJECT_ROOT, absPath);
  return r.startsWith('..') ? absPath : r;
}

/* ══════════════════════════════════════════════════════════════
   PROCESS ONE FILE
   ══════════════════════════════════════════════════════════════ */
async function processFile(filePath, { skipBuild, skipDeploy, deployOnly }) {
  const fileName = basename(filePath);

  /* ── Route ── */
  let targetDir;
  if (!deployOnly) {
    targetDir = routeFile(fileName);

    if (targetDir === null) {
      log('warn', `Unrecognized file "${fileName}" — can't determine target subfolder.`);
      const answer = await ask('Copy to public/geoJSON/ root instead? [y/N]');
      if (answer !== 'y' && answer !== 'yes') {
        log('error', 'Skipped.');
        return false;
      }
      targetDir = '';
    }
  }

  /* ── Validate ── */
  if (!deployOnly) {
    log('info', `Validating ${fileName}...`);
    let content;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      log('error', `Cannot read file: ${err.message}`);
      return false;
    }

    const ext = extname(fileName).toLowerCase();
    if (!['.geojson', '.topojson', '.json'].includes(ext)) {
      log('warn', `Extension "${ext}" is unusual. Expected .geojson, .topojson, or .json. Proceeding...`);
    }

    if (!isValidGeoJSON(content)) {
      log('error', 'File does not appear to be valid GeoJSON or TopoJSON (missing recognised "type" field).');
      return false;
    }

    /* ── Copy ── */
    const destDir = join(PUBLIC_GEOJSON, targetDir);
    const destPath = join(destDir, fileName);

    await mkdir(destDir, { recursive: true });
    const isUpdate = existsSync(destPath);
    const sizeMB = (content.length / 1024 / 1024).toFixed(1);

    await copyFile(filePath, destPath);
    log('ok', `${isUpdate ? 'Updated' : 'Added'} ${targetDir ? targetDir + '/' : ''}${fileName} (${sizeMB} MB)`);
  }

  if (skipBuild) {
    log('info', 'Skipping build (--skip-build).');
    return true;
  }

  /* ── Build ── */
  log('info', 'Building app (npm run build)...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: PROJECT_ROOT });
  } catch {
    log('error', 'Build failed — stopping. Existing deployment is unchanged.');
    return false;
  }
  log('ok', 'Build complete.');

  if (skipDeploy) {
    log('info', 'Skipping deploy (--skip-deploy).');
    return true;
  }

  /* ── Deploy ── */
  log('info', 'Deploying via FTP...');
  try {
    execSync(`node "${DEPLOY_SCRIPT}" --skip-build`, { stdio: 'inherit', cwd: PROJECT_ROOT });
  } catch {
    log('error', 'Deploy failed. Build output is still in dist/ — retry with "npm run deploy".');
    return false;
  }
  log('ok', 'Deploy complete.');

  return true;
}

/* ══════════════════════════════════════════════════════════════
   WATCHER MODE
   ══════════════════════════════════════════════════════════════ */
async function watchMode() {
  await mkdir(GIS_DROP, { recursive: true });

  console.log(`\n  ${C.blue}▸${C.reset} Watching ${C.yellow}${shortPath(GIS_DROP)}${C.reset} for new files...`);
  console.log(`  ${C.dim}·${C.reset} Drop .geojson / .topojson / .json files into this folder.`);
  console.log(`  ${C.dim}·${C.reset} Processed files are moved to ${C.yellow}.done/${C.reset} subfolder.`);
  console.log(`  ${C.dim}·${C.reset} Press ${C.yellow}Ctrl+C${C.reset} to stop.\n`);

  let processing = false;
  const seen = new Set();

  /* Seed with files already present (including .done/) */
  function scanDone() {
    const doneDir = join(GIS_DROP, '.done');
    if (existsSync(doneDir)) {
      for (const f of readdirSync(doneDir)) seen.add(f);
    }
  }
  scanDone();

  setInterval(async () => {
    if (processing) return;
    if (!existsSync(GIS_DROP)) return;

    let entries;
    try { entries = readdirSync(GIS_DROP); } catch { return; }

    const candidates = entries.filter(f =>
      !f.startsWith('.') &&
      (f.endsWith('.geojson') || f.endsWith('.topojson') || f.endsWith('.json'))
    );

    for (const file of candidates) {
      if (seen.has(file)) continue;

      const filePath = join(GIS_DROP, file);
      let stats;
      try { stats = statSync(filePath); } catch { continue; }
      if (!stats.isFile() || stats.size === 0) continue;

      /* Wait for stability (file may still be copying) */
      let size = stats.size;
      await sleep(STABILITY_MS);
      try {
        const s2 = statSync(filePath);
        if (s2.size !== size) continue; /* still growing */
        if (s2.size === 0) continue;
      } catch { continue; }

      processing = true;
      seen.add(file);

      log('info', `\nDetected: ${shortPath(filePath)}`);

      try {
        const ok = await processFile(filePath, { skipBuild: false, skipDeploy: false, deployOnly: false });
        if (ok) {
          log('ok', `Done processing ${file}\n`);
          /* Move to .done/ with timestamp to avoid re-processing */
          const doneDir = join(GIS_DROP, '.done');
          await mkdir(doneDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          await rename(filePath, join(doneDir, `${ts}_${file}`));
        } else {
          log('error', `Failed to process ${file} — leaving in place for inspection.\n`);
        }
      } catch (err) {
        log('error', `Unexpected error processing ${file}: ${err.message}\n`);
      } finally {
        processing = false;
      }
    }
  }, POLL_MS);

  return new Promise(() => {}); /* run until Ctrl+C */
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */
async function main() {
  const args = process.argv.slice(2);

  const skipBuild = args.includes('--skip-build');
  const skipDeploy = args.includes('--skip-deploy');
  const deployOnly = args.includes('--deploy-only');
  const isWatch = args.includes('--watch');

  if (isWatch) {
    await watchMode();
    return;
  }

  if (deployOnly) {
    log('info', 'Deploy-only — building + uploading without file copy.');
    try {
      execSync(`node "${DEPLOY_SCRIPT}"`, { stdio: 'inherit', cwd: PROJECT_ROOT });
    } catch {
      process.exit(1);
    }
    return;
  }

  /* One-shot: file path */
  const filePath = args.find(a => !a.startsWith('--'));
  if (!filePath) {
    console.log(`
${C.blue}Usage:${C.reset}
  node scripts/update-deploy.mjs <file>           ${C.dim}Process a single file${C.reset}
  node scripts/update-deploy.mjs --watch           ${C.dim}Watch gis-drop/ folder for drops${C.reset}
  node scripts/update-deploy.mjs --deploy-only     ${C.dim}Build + deploy without copying files${C.reset}

${C.dim}Flags:${C.reset}
  --skip-build    ${C.dim}Copy only, skip build + deploy${C.reset}
  --skip-deploy   ${C.dim}Build but skip FTP deploy${C.reset}
`);
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    log('error', `File not found: ${filePath}`);
    process.exit(1);
  }

  const ok = await processFile(filePath, { skipBuild, skipDeploy, deployOnly });
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
