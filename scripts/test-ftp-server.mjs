#!/usr/bin/env node
/**
 * test-ftp-server.mjs — Minimal FTP server for testing the deploy script.
 * Zero external deps — uses Node.js built-in net + fs/promises.
 *
 * Usage:  node scripts/test-ftp-server.mjs    # port 2121
 *
 * FileZilla: 127.0.0.1:2121  test / test  FTP (plain)
 *
 * Design: One persistent PASV server per control connection. Each file
 * transfer gets its own data socket on the same PASV port. STOR waits
 * briefly if the data socket hasn't arrived yet (basic-ftp can send
 * the STOR command before the data TCP connection is fully dispatched
 * by the event loop).
 */

import { createServer } from 'net';
import { writeFile, mkdir, stat, readdir, rm, unlink } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';

const PORT = parseInt(process.env.PORT || '2121', 10);
const FTP_ROOT = resolve(import.meta.dirname, '..', 'test-ftp-root');

function send(s, code, msg) { s.write(`${code} ${msg}\r\n`); }

async function main() {
  await mkdir(FTP_ROOT, { recursive: true });

  createServer((socket) => {
    let cwd = '/';
    let pasvSrv = null;
    let pasvPort = 0;
    let dataConnResolve = null;
    let dataConnTimeout = null;

    function toLocal(p) {
      const rel = p.startsWith('/') ? p.slice(1) : cwd === '/' ? p : cwd.slice(1) + '/' + p;
      return join(FTP_ROOT, decodeURIComponent(rel));
    }

    function waitForDataSocket(timeout = 5000) {
      if (socket._ds && !socket._ds.destroyed) return Promise.resolve(socket._ds);
      return new Promise((resolve, reject) => {
        dataConnResolve = resolve;
        dataConnTimeout = setTimeout(() => {
          reject(new Error('Data connection timeout'));
          dataConnResolve = null;
        }, timeout);
      });
    }

    send(socket, 220, 'geoMonitor test FTP server ready');

    /* One persistent PASV server for the entire control connection */
    pasvSrv = createServer();
    pasvSrv.on('connection', (ds) => {
      socket._ds = ds;
      ds.on('error', () => {});
      ds.on('close', () => {
        if (socket._ds === ds) socket._ds = null;
      });
      if (dataConnResolve) {
        clearTimeout(dataConnTimeout);
        dataConnResolve(ds);
        dataConnResolve = null;
        dataConnTimeout = null;
      }
    });
    pasvSrv.listen(0, '127.0.0.1', () => {
      pasvPort = pasvSrv.address().port;
    });

    socket.on('data', async (raw) => {
      const line = raw.toString().trim();
      if (!line) return;
      const idx = line.indexOf(' ');
      const cmd = (idx === -1 ? line : line.slice(0, idx)).toUpperCase();
      const arg = idx === -1 ? '' : line.slice(idx + 1);

      try {
        switch (cmd) {
          case 'USER': send(socket, 331, 'OK'); break;
          case 'PASS': send(socket, 230, 'OK'); break;
          case 'TYPE': send(socket, 200, 'OK'); break;
          case 'STRU': case 'MODE': case 'OPTS': case 'NOOP': send(socket, 200, 'OK'); break;
          case 'SYST': send(socket, 215, 'UNIX Type: L8'); break;
          case 'PWD':  send(socket, 257, `"${cwd}"`); break;
          case 'EPSV': send(socket, 522, 'Network protocol not supported, use (1)'); break;

          case 'CWD': {
            cwd = resolve(cwd, arg);
            send(socket, 250, 'OK');
            break;
          }
          case 'CDUP': {
            cwd = dirname(cwd) || '/';
            send(socket, 250, 'OK');
            break;
          }
          case 'MKD': {
            await mkdir(toLocal(arg), { recursive: true });
            send(socket, 257, `Created "${arg}"`);
            break;
          }
          case 'SIZE': {
            try { send(socket, 213, String((await stat(toLocal(arg))).size)); }
            catch { send(socket, 550, 'File not found'); }
            break;
          }
          case 'PASV': {
            /* The pasvSrv is already listening on pasvPort. Send the same
               port every time — each new transfer gets a new data socket
               on the same port, replacing the old one. */
            const p1 = Math.floor(pasvPort / 256), p2 = pasvPort % 256;
            dataConnResolve = null; // reset for the new connection
            send(socket, 227, `Entering Passive Mode (127,0,0,1,${p1},${p2})`);
            break;
          }
          case 'LIST': {
            try {
              const ds = await waitForDataSocket();
              send(socket, 150, 'OK');
              const ents = await readdir(toLocal(cwd), { withFileTypes: true });
              const lines = [];
              for (const e of ents) {
                const full = join(toLocal(cwd), e.name);
                const st = await stat(full);
                const perms = st.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--';
                const size = st.isDirectory() ? 4096 : st.size;
                const date = st.mtime.toISOString().slice(0, 16).replace('T', ' ');
                lines.push(`${perms} 1 ftp ftp ${String(size).padStart(12)} ${date} ${e.name}`);
              }
              ds.write(lines.join('\r\n') + '\r\n');
              ds.end();
            } catch { send(socket, 425, 'No data connection'); break; }
            send(socket, 226, 'OK');
            break;
          }
          case 'STOR': {
            let ds;
            try { ds = await waitForDataSocket(); }
            catch { send(socket, 425, 'No data connection'); break; }
            send(socket, 150, 'OK');
            const chunks = [];
            ds.on('data', (c) => chunks.push(c));
            ds.on('end', async () => {
              try {
                const t = toLocal(arg);
                await mkdir(dirname(t), { recursive: true });
                await writeFile(t, Buffer.concat(chunks));
                send(socket, 226, 'OK');
              } catch (e) { send(socket, 550, e.message); }
            });
            break;
          }
          case 'DELE': {
            try { await unlink(toLocal(arg)); send(socket, 250, 'OK'); }
            catch (e) { send(socket, 550, e.message); }
            break;
          }
          case 'RMD': {
            try { await rm(toLocal(arg), { recursive: true }); send(socket, 250, 'OK'); }
            catch (e) { send(socket, 550, e.message); }
            break;
          }
          case 'QUIT':
            send(socket, 221, 'Bye');
            socket.end();
            break;
          default:
            send(socket, 502, `Not impl: ${cmd}`);
        }
      } catch (e) { send(socket, 550, e.message); }
    });

    socket.on('error', () => {});
    socket.on('close', () => pasvSrv.close());
  }).listen(PORT, '127.0.0.1', () => {
    console.log(`\n✓ test FTP on 127.0.0.1:${PORT}`);
    console.log(`  FileZilla: 127.0.0.1:${PORT}  test / test  (plain FTP)`);
    console.log(`  test-ftp-root/ for uploaded files`);
    console.log(`  Press Ctrl+C to stop.\n`);
  });
}

main();
