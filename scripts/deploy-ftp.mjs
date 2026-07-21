#!/usr/bin/env node
/**
 * deploy-ftp.mjs — Build the app and upload dist/ to a FileZilla FTP server.
 *
 * SAFETY: This script NEVER deletes, removes, or cleans anything on the
 * remote server. It only:
 *   1. Creates directories that don't exist yet (ensureDir)
 *   2. Overwrites individual files that match local paths (uploadFrom)
 *   3. Reads file sizes for change detection (size)
 *
 * Any existing files on the server that are NOT in dist/ or being pushed
 * via --push-geojson are left untouched.
 *
 * Usage:
 *   node scripts/deploy-ftp.mjs                            # build + upload dist/
 *   node scripts/deploy-ftp.mjs --skip-build               # upload dist/ only (skip vite build)
 *   node scripts/deploy-ftp.mjs --push-geojson             # push public/geoJSON/ raw files to FTP
 *   node scripts/deploy-ftp.mjs --push-geojson --skip-build  # push geoJSON only (no dist/, no build)
 *   node scripts/deploy-ftp.mjs --dry-run                  # preview what would be uploaded
 *
 * Requires a .env file in the project root with:
 *   FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR, FTP_PASSIVE
 */

import { Client } from 'basic-ftp';
import { statSync, readdirSync } from 'fs';
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
const DRY_RUN = process.argv.includes('--dry-run');
const PUSH_GEOJSON = process.argv.includes('--push-geojson');
const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const GEOJSON_DIR = join(import.meta.dirname, '..', 'public', 'geoJSON');

/* Files served from Supabase — exclude from FTP push */
const SUPABASE_SERVED_PATTERNS = [/_Slope\.geojson$/, /_LCM\d*\.geojson$/];
function isSupabaseServed(localPath) {
  return SUPABASE_SERVED_PATTERNS.some(re => re.test(localPath));
}

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

/* ── Build step (only when pushing dist/ without --skip-build) ── */
if (!SKIP_BUILD && !PUSH_GEOJSON) {
  console.log('\x1b[36m▸ Building app...\x1b[0m');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: join(import.meta.dirname, '..') });
    console.log('\x1b[32m✓ Build complete\x1b[0m\n');
  } catch {
    console.error('\x1b[31m✗ Build failed — aborting upload\x1b[0m');
    process.exit(1);
  }
} else if (SKIP_BUILD || PUSH_GEOJSON) {
  console.log('\x1b[33m▸ Skipping build\x1b[0m\n');
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

const distFiles = PUSH_GEOJSON ? [] : listFiles(DIST_DIR);
const geoJSONFiles = PUSH_GEOJSON
  ? listFiles(GEOJSON_DIR).filter(f => !isSupabaseServed(f.local))
  : [];

/* ── Upload helper ── */
async function uploadFiles(files, remoteBase, label) {
  if (!files.length) return { uploaded: 0, skipped: 0, created: 0 };

  console.log(`\x1b[36m▸ ${DRY_RUN ? 'DRY RUN —' : ''} Scanning ${files.length} ${label} files for ${FTP_HOST}:${remoteBase}\x1b[0m\n`);

  let uploaded = 0;
  let skipped = 0;
  let created = 0;

  await ftp.ensureDir(remoteBase);

  for (const { local, remote } of files) {
    const remotePath = (remoteBase === '/' ? '' : remoteBase) + '/' + remote;

    /* Quick size check to skip unchanged files */
    let remoteSize = null;
    try {
      remoteSize = await ftp.size(remotePath);
    } catch {
      /* file doesn't exist remotely — will be created */
    }

    const localSize = statSync(local).size;

    if (remoteSize === localSize) {
      skipped++;
      if (DRY_RUN) {
        console.log(`  \x1b[90m=\x1b[0m ${remote} (unchanged)`);
      }
      continue;
    }

    const isNew = remoteSize === null;
    if (isNew) created++;

    if (DRY_RUN) {
      const label = isNew ? '\x1b[33m+ new\x1b[0m' : `\x1b[36m~ update (${remoteSize ?? 0} → ${localSize})\x1b[0m`;
      console.log(`  ${label} ${remote}`);
      uploaded++;
      continue;
    }

    const dirPart = remotePath.substring(0, remotePath.lastIndexOf('/'));
    if (dirPart) await ftp.ensureDir(dirPart);

    await ftp.uploadFrom(local, remotePath);
    uploaded++;
    process.stdout.write(`\r  \x1b[32m✓\x1b[0m ${remote} `.padEnd(80));
  }

  return { uploaded, skipped, created };
}

/* ── Upload via FTP ── */
const ftp = new Client();

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

  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalCreated = 0;

  /* Upload dist/ files */
  if (distFiles.length) {
    const r = await uploadFiles(distFiles, FTP_REMOTE_DIR, 'dist');
    totalUploaded += r.uploaded;
    totalSkipped += r.skipped;
    totalCreated += r.created;
  }

  /* Upload geoJSON raw files */
  if (geoJSONFiles.length) {
    const geoRemoteBase = (FTP_REMOTE_DIR === '/' ? '' : FTP_REMOTE_DIR) + '/geoJSON';
    const r = await uploadFiles(geoJSONFiles, geoRemoteBase, 'geoJSON');
    totalUploaded += r.uploaded;
    totalSkipped += r.skipped;
    totalCreated += r.created;
  }

  if (DRY_RUN) {
    console.log(`\n\n\x1b[33m▸ Dry run complete — ${totalUploaded} to upload (${totalCreated} new), ${totalSkipped} unchanged\x1b[0m`);
    console.log('  Run without --dry-run to apply changes.');
  } else {
    console.log(`\n\n\x1b[32m✓ ${PUSH_GEOJSON ? 'GeoJSON push' : 'Deploy'} complete — ${totalUploaded} uploaded, ${totalSkipped} unchanged\x1b[0m`);
  }
} catch (err) {
  console.error(`\n\x1b[31m✗ FTP error: ${err.message}\x1b[0m`);
  process.exit(1);
} finally {
  ftp.close();
}
