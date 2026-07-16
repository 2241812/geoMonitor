#!/usr/bin/env node
/**
 * deploy-ftp.mjs — Build the app and upload dist/ to a FileZilla FTP server.
 *
 * Usage:
 *   node scripts/deploy-ftp.mjs          # build + upload
 *   node scripts/deploy-ftp.mjs --skip-build   # upload only (skip vite build)
 *
 * Requires a .env file in the project root with:
 *   FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR, FTP_PASSIVE
 */

import { Client } from 'basic-ftp';
import { readFileSync, statSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import { execSync } from 'child_process';
import { config } from 'dotenv';

config(); /* load .env */

const FTP_HOST = process.env.FTP_HOST;
const FTP_PORT = parseInt(process.env.FTP_PORT || '21', 10);
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
const FTP_REMOTE_DIR = process.env.FTP_REMOTE_DIR || '/';
const FTP_PASSIVE = process.env.FTP_PASSIVE !== 'false';

const SKIP_BUILD = process.argv.includes('--skip-build');
const DIST_DIR = join(import.meta.dirname, '..', 'dist');

/* ── Validate env ── */
function requireEnv(name, val) {
  if (!val) {
    console.error(`\x1b[31m✗ Missing ${name} in .env\x1b[0m`);
    console.error('  Copy .env.example to .env and fill in your FTP credentials.');
    process.exit(1);
  }
}
requireEnv('FTP_HOST', FTP_HOST);
requireEnv('FTP_USER', FTP_USER);
requireEnv('FTP_PASSWORD', FTP_PASSWORD);

/* ── Build step ── */
if (!SKIP_BUILD) {
  console.log('\x1b[36m▸ Building app...\x1b[0m');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: join(import.meta.dirname, '..') });
    console.log('\x1b[32m✓ Build complete\x1b[0m\n');
  } catch {
    console.error('\x1b[31m✗ Build failed — aborting upload\x1b[0m');
    process.exit(1);
  }
} else {
  console.log('\x1b[33m▸ Skipping build (--skip-build)\x1b[0m\n');
}

/* ── Collect files to upload ── */
function listFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(full, base));
    } else {
      results.push({ local: full, remote: relative(base, full).split(sep).join('/') });
    }
  }
  return results;
}

const files = listFiles(DIST_DIR);
console.log(`\x1b[36m▸ Uploading ${files.length} files to ${FTP_HOST}:${FTP_REMOTE_DIR}\x1b[0m\n`);

/* ── Upload via FTP ── */
const ftp = new Client();
let uploaded = 0;
let skipped = 0;

try {
  await ftp.access({
    host: FTP_HOST,
    port: FTP_PORT,
    user: FTP_USER,
    password: FTP_PASSWORD,
    secure: false,
    passive: FTP_PASSIVE,
  });
  console.log('\x1b[32m✓ Connected to FTP server\x1b[0m\n');

  /* Ensure remote dir exists */
  await ftp.ensureDir(FTP_REMOTE_DIR);

  for (const { local, remote } of files) {
    const remotePath = (FTP_REMOTE_DIR === '/' ? '' : FTP_REMOTE_DIR) + '/' + remote;

    /* Quick size check to skip unchanged files */
    try {
      const localSize = statSync(local).size;
      const remoteInfo = await ftp.size(remotePath).catch(() => null);
      if (remoteInfo === localSize) {
        skipped++;
        continue;
      }
    } catch {
      /* file doesn't exist remotely — that's fine, upload it */
    }

    const dirPart = remotePath.substring(0, remotePath.lastIndexOf('/'));
    if (dirPart) await ftp.ensureDir(dirPart);

    await ftp.uploadFrom(local, remotePath);
    uploaded++;
    process.stdout.write(`\r  \x1b[32m✓\x1b[0m ${remote} `.padEnd(80));
  }

  console.log(`\n\n\x1b[32m✓ Deploy complete — ${uploaded} uploaded, ${skipped} unchanged\x1b[0m`);
} catch (err) {
  console.error(`\n\x1b[31m✗ FTP error: ${err.message}\x1b[0m`);
  process.exit(1);
} finally {
  ftp.close();
}
