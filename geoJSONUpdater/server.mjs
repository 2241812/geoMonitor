#!/usr/bin/env node
/**
 * geoJSONUpdater/server.mjs — GeoMonitor Deploy GUI
 *
 * Flow: auto-pull on open → drag-drop GeoJSON → one-click deploy to FTP.
 * Shows real-time logs + upload progress bar.
 *
 * Usage:  node geoJSONUpdater/server.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.GUI_PORT || '3479', 10);
const PUBLIC_GEOJSON = path.join(PROJECT_ROOT, 'public', 'geoJSON');
const DEPLOY_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'deploy-ftp.mjs');

/* ── Basin routing (mirrors update-deploy.mjs) ── */
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

function routeFile(filename) {
  const base = path.basename(filename);
  if (base.startsWith('CAR ') || base.startsWith('Slope') || base.startsWith('hierarchy') || base.includes('intersections') || base === 'hierarchy.json') return '';
  if (base.includes('_LCM2025') || base.includes('_LCM')) return 'LCM';
  if (base.startsWith('cad_') || base.startsWith('namria_')) return 'Overlays';
  const prefix = base.split('_')[0].toUpperCase();
  if (BASIN_MAP[prefix]) return BASIN_MAP[prefix];
  return null;
}

/* ── Global state ── */
let currentProc = null;
let currentOp = 'idle';
const logHistory = [];
let sseClients = [];
let deployProgress = { total: 0, current: 0, phase: '' }; /* phase: 'building' | 'uploading' */

function resetProgress() { deployProgress = { total: 0, current: 0, phase: '' }; }

/* ── Emit helpers ── */
function emit(level, msg) {
  const entry = { level, msg, ts: Date.now() };
  logHistory.push(entry);
  if (logHistory.length > 2000) logHistory.shift();
  for (const c of sseClients) c.res.write(`data: ${JSON.stringify(entry)}\n\n`);
  const sym = ({ info:' ▸', ok:' ✓', warn:' ⚠', error:' ✗', stdout:'   ', stderr:'   ', progress:'' })[level] || '   ';
  // Only print non-progress to console to avoid noise
  if (level !== 'progress') console.log(`${sym} ${msg}`);
}

function emitProgress(pct, label) {
  const entry = { level: 'progress', msg: label, ts: Date.now(), progress: pct };
  for (const c of sseClients) c.res.write(`data: ${JSON.stringify(entry)}\n\n`);
}

/* ── Run a process, streaming stdout/stderr and optionally tracking progress ── */
function runProc(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, ...opts.env },
    });
    currentProc = proc;
    let allOut = '';

    const progressTracker = opts.trackProgress;

    /* Pre-count dist/ files for reliable progress tracking */
    if (progressTracker) {
      const distDir = path.join(PROJECT_ROOT, 'dist');
      if (fs.existsSync(distDir)) {
        let total = 0;
        function countFiles(dir) {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) countFiles(full);
            else total++;
          }
        }
        countFiles(distDir);
        deployProgress.total = Math.max(total, 1);
      }
    }

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      allOut += text;

      if (progressTracker) {
        /* Also try "Scanning N files" for a more precise count */
        const scanMatch = text.match(/Scanning\s+(\d+)\s+files/);
        if (scanMatch) deployProgress.total = parseInt(scanMatch[1], 10);

        /* Count upload completions by matching ✓ at line start with file paths
           (filters out "✓ Connected to FTP server" and "✓ Deploy complete") */
        const fileUploads = (text.match(/✓\s+[\w\/\.\-]+/g) || []).length;
        if (fileUploads > 0) {
          deployProgress.current += fileUploads;
          const pct = Math.min(Math.round((deployProgress.current / deployProgress.total) * 100), 100);
          emitProgress(pct, `Uploading ${deployProgress.current}/${deployProgress.total}`);
        }
      }

      /* Process lines for the log */
      for (const line of text.split('\n').filter(Boolean)) {
        const trimmed = line.trim();
        if (trimmed) emit('stdout', trimmed);
      }
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      allOut += text;
      for (const line of text.split('\n').filter(Boolean)) emit('stderr', line);
    });

    proc.on('error', (e) => { currentProc = null; reject(e); });
    proc.on('close', (code) => {
      currentProc = null;
      if (progressTracker) emitProgress(100, 'Upload complete');
      code === 0 ? resolve(allOut) : reject(new Error(`exit code ${code}`));
    });
  });
}

/* ── Handlers ── */

async function doPull() {
  currentOp = 'pulling';
  emit('info', '═══ Pulling from git ═══');
  try {
    await runProc('git', ['pull', 'origin', 'main']);
    emit('ok', 'Repository is up to date.');
    currentOp = 'idle';
    return { success: true };
  } catch (err) {
    emit('warn', `Git pull: ${err.message.split('\n')[0]}`);
    currentOp = 'idle';
    return { success: true };
  }
}

async function doGeoJSON(filePath, originalName) {
  emit('info', `Processing: ${originalName}`);
  let content;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { return { success: false, error: 'Cannot read file' }; }
  let data;
  try { data = JSON.parse(content); } catch { return { success: false, error: 'Invalid JSON' }; }
  if (!data.type) return { success: false, error: 'Not GeoJSON/TopoJSON (missing "type")' };

  const targetDir = routeFile(originalName);
  const destDir = path.join(PUBLIC_GEOJSON, targetDir || '');
  const destPath = path.join(destDir, originalName);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(filePath, destPath);

  const sizeKB = (content.length / 1024).toFixed(0);
  emit('ok', `Staged: ${targetDir ? targetDir + '/' : ''}${originalName} (${sizeKB} KB)`);

  if (!global.fileList) global.fileList = [];
  global.fileList.push({ name: originalName, folder: targetDir || '(root)', size: sizeKB + ' KB' });
  return { success: true };
}

async function doDeploy() {
  emit('info', '═══ Deploying to FTP ═══');
  resetProgress();
  deployProgress.phase = 'building';
  emitProgress(0, 'Building app...');

  try {
    /* Step 1: Build */
    emit('info', '[1/2] Building...');
    await runProc('npm', ['run', 'build'], { trackProgress: false });
    emit('ok', 'Build complete.');

    /* Step 2: FTP Upload with progress */
    deployProgress.phase = 'uploading';
    emitProgress(0, 'Uploading to FTP...');
    emit('info', '[2/2] Uploading via FTP...');

    await runProc('node', [`"${DEPLOY_SCRIPT}"`, '--skip-build'], { trackProgress: true });
    emitProgress(100, 'Deploy complete');

    global.fileList = [];
    currentOp = 'idle';
    emit('ok', '═══ Deploy successful ═══');
    return { success: true };
  } catch (err) {
    currentOp = 'idle';
    emit('error', `Deploy failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function doCancel() {
  if (currentProc) {
    try { execSync(`taskkill /PID ${currentProc.pid} /T /F 2>nul`, { stdio: 'ignore' }); } catch {}
    try { currentProc.kill('SIGTERM'); } catch {}
    currentProc = null;
  }
  currentOp = 'idle';
  emit('warn', 'Cancelled.');
}

/* ══════════════════════════════════════════════
   HTTP Server
   ══════════════════════════════════════════════ */

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname, m = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (m === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* SSE log stream */
  if (p === '/api/logs' && m === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    for (const e of logHistory) res.write(`data: ${JSON.stringify(e)}\n\n`);
    const client = { id: Date.now(), res };
    sseClients.push(client);
    req.on('close', () => { sseClients = sseClients.filter(c => c.id !== client.id); });
    return;
  }

  /* Status */
  if (p === '/api/status' && m === 'GET') {
    return json(res, {
      operation: currentOp,
      running: currentProc !== null,
      files: global.fileList || [],
      progress: deployProgress,
    });
  }

  /* Pull */
  if (p === '/api/pull' && m === 'POST') {
    if (currentProc) return json(res, { error: 'Busy' }, 409);
    const r = await doPull();
    return json(res, r, r.success ? 200 : 500);
  }

  /* Deploy */
  if (p === '/api/deploy' && m === 'POST') {
    if (currentProc) return json(res, { error: 'Already running' }, 409);
    const r = await doDeploy();
    return json(res, r, r.success ? 200 : 500);
  }

  /* Cancel */
  if (p === '/api/cancel' && m === 'POST') {
    doCancel();
    return json(res, { success: true });
  }

  /* GeoJSON upload */
  if (p === '/api/geojson' && m === 'POST') {
    if (currentProc) return json(res, { error: 'Busy' }, 409);
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) return json(res, { error: 'Expected multipart' }, 400);
    const boundary = ct.split('boundary=')[1];
    if (!boundary) return json(res, { error: 'No boundary' }, 400);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const text = raw.toString('latin1');
    const parts = text.split(`--${boundary}`).filter(p => p.includes('filename="'));
    if (!parts.length) return json(res, { error: 'No file' }, 400);
    const nm = parts[0].match(/filename="([^"]+)"/);
    const fileName = nm ? nm[1] : 'upload.geojson';
    const hEnd = parts[0].indexOf('\r\n\r\n');
    if (hEnd === -1) return json(res, { error: 'Malformed' }, 400);
    let fc = parts[0].slice(hEnd + 4).replace(/\r?\n--\s*$/, '').trim();

    const tmpDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, fileName);
    fs.writeFileSync(tmpPath, fc, 'utf-8');

    const r = await doGeoJSON(tmpPath, fileName);
    return json(res, r, r.success ? 200 : 500);
  }

  /* Files list */
  if (p === '/api/files' && m === 'GET') {
    return json(res, global.fileList || []);
  }

  /* Serve HTML */
  if (p === '/' || p === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  /* Shutdown */
  if (p === '/api/shutdown' && m === 'POST') {
    json(res, { success: true });
    /* Give the response time to send before closing */
    setTimeout(() => {
      for (const c of sseClients) c.res.end();
      server.close(() => process.exit(0));
    }, 300);
    return;
  }

  res.writeHead(404); res.end('Not found');
}

const server = http.createServer(handler);

function tryListen(port, retried) {
  server.listen(port, '127.0.0.1', () => {
    global.SERVER_PORT = port;
    const url = `http://127.0.0.1:${port}`;
    console.log('');
    console.log('  ╔════════════════════════════════════╗');
    console.log('  ║   GeoMonitor — Deploy GUI          ║');
    console.log('  ╚════════════════════════════════════╝');
    console.log(`  ${url}`);
    console.log('');
    try { execSync(`start "" "${url}"`, { stdio: 'ignore' }); } catch {}
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (!retried) {
        /* Try to kill the process holding the port */
        try {
          console.log(`  Port ${port} in use — attempting to free it...`);
          const result = execSync(
            `for /f "tokens=5" %a in ('netstat -ano ^| findstr ":${port}" ^| findstr "LISTENING"') do @taskkill /f /pid %a 2>nul`,
            { stdio: 'pipe', timeout: 5000, encoding: 'utf-8' }
          );
          console.log(`  Killed process on port ${port}. Retrying...`);
        } catch { /* nothing to kill — fall through to port bump */ }
        server.close();
        /* Wait a moment for the port to be released */
        setTimeout(() => tryListen(port, true), 1500);
      } else if (port < PORT + 10) {
        console.log(`  Port ${port} still in use, trying ${port + 1}...`);
        server.close();
        tryListen(port + 1, false);
      } else {
        console.error(`  ✗ Failed to start after trying ports ${PORT}-${PORT + 9}`);
        process.exit(1);
      }
    } else {
      console.error(`  ✗ Failed to start: ${err.message}`);
      process.exit(1);
    }
  });
}

tryListen(PORT);
