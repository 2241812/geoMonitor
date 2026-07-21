#!/usr/bin/env python3
"""
Deploy Tool — Updates local GeoJSON files, uploads slope/LCM to Supabase,
then builds and deploys to FTP.

Drop any file — the tool auto-detects the destination:
  *_Slope.geojson     → public/geoJSON/ + Supabase slope table
  *_LCM2025.geojson   → public/geoJSON/LCM/ + Supabase lcm table
  Everything else     → matched by filename under public/geoJSON/

Usage:
  Double-click the .exe or run:  python scripts/upload-slope-lcm.py
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import sys
import threading
import webbrowser
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Any, Callable
from ftplib import FTP
from tkinterdnd2 import TkinterDnD, DND_FILES

try:
    import requests
except ImportError:
    messagebox.showerror("Missing dependency", "Run: pip install requests")
    sys.exit(1)

# ── Paths ──
if getattr(sys, "frozen", False):
    PROJECT_ROOT = os.path.dirname(sys.executable)
else:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))

DOT_ENV = os.path.join(PROJECT_ROOT, ".env")
GEOJSON_ROOT = os.path.join(PROJECT_ROOT, "public", "geoJSON")
LCM_DIR = os.path.join(GEOJSON_ROOT, "LCM")
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")

# ── Credentials (loaded from .env) ──
SUPABASE_URL: str | None = None
SUPABASE_SERVICE_KEY: str | None = None
FTP_HOST: str | None = None
FTP_USER: str | None = None
FTP_PASS: str | None = None
FTP_REMOTE_DIR: str | None = None
FTP_PORT: int = 21
FTP_PASSIVE: bool = True

# ─────────────────────────────────────────────
#  .env loader
# ─────────────────────────────────────────────
def load_env(path: str) -> None:
    global SUPABASE_URL, SUPABASE_SERVICE_KEY, FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR, FTP_PORT, FTP_PASSIVE
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # Strip optional 'export ' prefix
            if line.startswith("export "):
                line = line[7:].lstrip()
            # Split on first '=' only
            if "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip()
            # Strip surrounding quotes (single or double) from value
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
                v = v[1:-1]
            # Unescape common escape sequences in values
            v = v.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t")
            # Key matching (case-sensitive match)
            if k == "SUPABASE_URL":
                SUPABASE_URL = v
            elif k == "SUPABASE_SERVICE_KEY":
                SUPABASE_SERVICE_KEY = v
            elif k == "FTP_HOST":
                FTP_HOST = v
            elif k == "FTP_USER":
                FTP_USER = v
            elif k in ("FTP_PASS", "FTP_PASSWORD"):
                FTP_PASS = v
            elif k == "FTP_REMOTE_DIR":
                FTP_REMOTE_DIR = v
            elif k == "FTP_PORT":
                try:
                    FTP_PORT = int(v)
                except ValueError:
                    pass
            elif k == "FTP_PASSIVE":
                FTP_PASSIVE = v.lower() in ("true", "1", "yes")


# ─────────────────────────────────────────────
#  File routing
# ─────────────────────────────────────────────
RE_SLOPE = re.compile(r"^(.+?)_Slope\.geojson$", re.IGNORECASE)
RE_LCM   = re.compile(r"^(.+?)_LCM2025\.geojson$", re.IGNORECASE)


def classify_file(filename: str) -> dict:
    """Return a routing dict for the given filename."""
    basename = os.path.basename(filename)
    ext = os.path.splitext(basename)[1].lower()

    result = {
        "basename": basename,
        "ext": ext,
        "action": "update local",      # default
        "supabase_table": None,
        "basin_code": None,
        "dest_dir": GEOJSON_ROOT,
    }

    # .env → load credentials
    if basename == ".env":
        result["action"] = "load credentials"
        return result

    # Slope
    m = RE_SLOPE.match(basename)
    if m:
        result["supabase_table"] = "slope"
        result["basin_code"] = m.group(1)
        result["dest_dir"] = GEOJSON_ROOT
        result["action"] = "update local + Supabase slope"
        return result

    # LCM
    m = RE_LCM.match(basename)
    if m:
        result["supabase_table"] = "lcm"
        result["basin_code"] = m.group(1)
        result["dest_dir"] = LCM_DIR
        result["action"] = "update local + Supabase lcm"
        return result

    # Everything else → find matching file in geoJSON tree
    match = _find_existing(basename)
    if match:
        result["dest_dir"] = os.path.dirname(match)
        result["action"] = f"update local (matches {os.path.relpath(match, GEOJSON_ROOT)})"
    else:
        result["dest_dir"] = GEOJSON_ROOT
        result["action"] = "update local (new file)"
    return result


def _find_existing(basename: str) -> str | None:
    """Walk public/geoJSON/ and return the path of the first file matching basename."""
    if not os.path.isdir(GEOJSON_ROOT):
        return None
    for root, _dirs, files in os.walk(GEOJSON_ROOT):
        for f in files:
            if f.lower() == basename.lower():
                return os.path.join(root, f)
    return None


# ─────────────────────────────────────────────
#  Douglas-Peucker  (pure Python)
# ─────────────────────────────────────────────
def _perp_dist(px: float, py: float, sx: float, sy: float,
               ex: float, ey: float) -> float:
    dx = ex - sx
    dy = ey - sy
    if dx == 0 and dy == 0:
        return math.hypot(px - sx, py - sy)
    return abs(dy * px - dx * py + ex * sy - ey * sx) / math.hypot(dx, dy)


def _simplify_ring(ring: list[list[float]], tol: float) -> list[list[float]]:
    if len(ring) <= 2:
        return ring
    dmax, idx = 0.0, 0
    for i in range(1, len(ring) - 1):
        d = _perp_dist(ring[i][0], ring[i][1],
                       ring[0][0], ring[0][1],
                       ring[-1][0], ring[-1][1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return _simplify_ring(ring[:idx + 1], tol)[:-1] + \
               _simplify_ring(ring[idx:], tol)
    return [ring[0], ring[-1]]


def simplify_geometry(geom: dict[str, Any], tol: float) -> dict[str, Any]:
    if tol <= 0:
        return geom
    g = json.loads(json.dumps(geom))
    if g["type"] == "Polygon":
        g["coordinates"] = [_simplify_ring(r, tol) for r in g["coordinates"]]
    elif g["type"] == "MultiPolygon":
        g["coordinates"] = [
            [_simplify_ring(r, tol) for r in poly] for poly in g["coordinates"]
        ]
    return g


def round_coords(geom: dict[str, Any], decimals: int = 4) -> dict[str, Any]:
    f = 10 ** decimals
    def _rr(ring: list[list[float]]) -> list[list[float]]:
        return [[round(c[0] * f) / f, round(c[1] * f) / f] for c in ring]
    g = json.loads(json.dumps(geom))
    if g["type"] == "Polygon":
        g["coordinates"] = [_rr(r) for r in g["coordinates"]]
    elif g["type"] == "MultiPolygon":
        g["coordinates"] = [[_rr(r) for r in poly] for poly in g["coordinates"]]
    return g


# ─────────────────────────────────────────────
#  Supabase REST helpers
# ─────────────────────────────────────────────
def _supa_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def supa_delete(table: str, basin: str) -> list[str]:
    msg: list[str] = []
    url = f"{SUPABASE_URL}/rest/v1/{table}?basin_code=eq.{basin}"
    try:
        r = requests.delete(url, headers=_supa_headers())
        if r.status_code in (200, 204):
            msg.append(f"  ✓ Cleared {basin} from {table}")
        else:
            msg.append(f"  ⚠ DELETE {r.status_code}")
        return msg
    except Exception as e:
        return [f"  ❌ DELETE error: {e}"]


def supa_insert(table: str, rows: list[dict],
                batch_size: int, on_prog: Callable) -> list[str]:
    msg: list[str] = []
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    total = len(rows)
    skipped_geom = False
    cur_bs = batch_size
    i = 0
    while i < total:
        batch = rows[i:i + cur_bs]
        if skipped_geom:
            for r in batch:
                r.pop("geom_simplified", None)
        try:
            r = requests.post(url, headers=_supa_headers(), json=batch)
            ok = r.status_code in (200, 201, 204)
            if not ok and r.status_code == 409:
                i += len(batch)
                continue
            if not ok:
                body = r.text[:300]
                if "geom_simplified" in body and not skipped_geom:
                    skipped_geom = True
                    for r2 in batch:
                        r2.pop("geom_simplified", None)
                    r2 = requests.post(url, headers=_supa_headers(), json=batch)
                    if r2.status_code in (200, 201, 204):
                        msg.append(f"  ✓ ({len(batch)} rows, no geom_simplified)")
                        i += len(batch)
                        on_prog(min(i, total), total)
                        continue
                if r.status_code >= 500 and cur_bs > 1:
                    cur_bs = max(1, cur_bs // 2)
                    msg.append(f"  ⚠ Halving batch: {cur_bs * 2}→{cur_bs}")
                    continue
                msg.append(f"  ❌ INSERT ({r.status_code}): {body[:150]}")
                return msg
            msg.append(f"  ✓ Batch ({len(batch)} rows)")
        except Exception as e:
            msg.append(f"  ❌ INSERT error: {e}")
            return msg
        i += len(batch)
        on_prog(min(i, total), total)
    return msg


# ─────────────────────────────────────────────
#  FTP deploy
# ─────────────────────────────────────────────
def build_project() -> list[str]:
    msg: list[str] = []
    msg.append("  git pull…")
    try:
        r = subprocess.run(["git", "pull"], capture_output=True, text=True,
                           cwd=PROJECT_ROOT, timeout=120)
        msg.append(f"    {r.stdout.strip() or 'done'}")
        if r.returncode != 0:
            msg.append(f"    ⚠ {r.stderr.strip()}")
    except Exception as e:
        return [f"  ❌ git pull failed: {e}"]

    msg.append("  npm run build…")
    try:
        r = subprocess.run(["npm", "run", "build"], capture_output=True, text=True,
                           cwd=PROJECT_ROOT, timeout=300)
        for line in r.stdout.splitlines():
            if "error" in line.lower() or "failed" in line.lower():
                msg.append(f"    {line.strip()}")
        if r.returncode != 0:
            msg.append(f"    ⚠ {r.stderr.strip()}")
            return msg + ["  ❌ Build failed"]
        msg.append("  ✓ Build complete")
    except Exception as e:
        return [f"  ❌ Build failed: {e}"]
    return msg


def ftp_upload() -> list[str]:
    msg: list[str] = []
    if not all([FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR]):
        return ["  ❌ Set FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR in .env"]

    if not os.path.isdir(DIST_DIR):
        return [f"  ❌ dist/ not found at {DIST_DIR}"]

    msg.append(f"  Connecting to {FTP_HOST}:{FTP_PORT}…")
    try:
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftp.set_pasv(FTP_PASSIVE)
        ftp.login(FTP_USER, FTP_PASS)
        msg.append("  ✓ Logged in")
    except Exception as e:
        return [f"  ❌ FTP connect failed: {e}"]

    try:
        ftp.cwd(FTP_REMOTE_DIR)
    except Exception:
        try:
            ftp.mkd(FTP_REMOTE_DIR)
            ftp.cwd(FTP_REMOTE_DIR)
        except Exception as e:
            ftp.quit()
            return [f"  ❌ Cannot cd/mkdir {FTP_REMOTE_DIR}: {e}"]

    uploaded = 0
    for root, _dirs, files in os.walk(DIST_DIR):
        for f in files:
            local = os.path.join(root, f)
            rel = os.path.relpath(local, DIST_DIR)
            # create subdirs on FTP
            rdir = os.path.dirname(rel).replace("\\", "/")
            if rdir and rdir != ".":
                try:
                    ftp.cwd(rdir)
                except Exception:
                    for part in rdir.split("/"):
                        try:
                            ftp.cwd(part)
                        except Exception:
                            ftp.mkd(part)
                            ftp.cwd(part)
                    ftp.cwd(FTP_REMOTE_DIR)
            try:
                with open(local, "rb") as fh:
                    ftp.storbinary(f"STOR {os.path.basename(rel)}", fh)
                uploaded += 1
            except Exception as e:
                msg.append(f"  ⚠ Failed to upload {rel}: {e}")
            if rdir and rdir != ".":
                ftp.cwd(FTP_REMOTE_DIR)

    ftp.quit()
    msg.append(f"  ✓ Uploaded {uploaded} files to {FTP_REMOTE_DIR}")
    return msg


def build_and_deploy(log_cb: Callable) -> None:
    log_cb("═══ Build & Deploy ═══")
    for m in build_project():
        log_cb(m)
    for m in ftp_upload():
        log_cb(m)
    log_cb("═══ Done ═══\n")


# ─────────────────────────────────────────────
#  GUI
# ─────────────────────────────────────────────
class DeployTool:
    def __init__(self) -> None:
        load_env(DOT_ENV)
        self.root = TkinterDnD.Tk()
        self.root.title("geoMonitor — Update & Deploy")
        self.root.geometry("860x720")
        self.root.resizable(True, True)

        self.files: list[dict] = []   # {path, basename, route, status}
        self.tol = tk.DoubleVar(value=0.0005)
        self.batch = tk.IntVar(value=5)

        self._build_ui()
        self._refresh_conn()

    # ──────── Layout ────────

    def _build_ui(self) -> None:
        main = ttk.Frame(self.root, padding=14)
        main.pack(fill=tk.BOTH, expand=True)

        # Row 0: Status bar
        top = ttk.Frame(main)
        top.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(top, text="Supabase:").pack(side=tk.LEFT)
        self.conn_lbl = ttk.Label(top, text="⏳", foreground="gray")
        self.conn_lbl.pack(side=tk.LEFT, padx=6)
        ttk.Label(top, text="  FTP:").pack(side=tk.LEFT)
        self.ftp_lbl = ttk.Label(top, text="⏳", foreground="gray")
        self.ftp_lbl.pack(side=tk.LEFT, padx=2)
        ttk.Button(top, text="Test", command=self._test_all,
                   width=7).pack(side=tk.RIGHT)

        # Row 1: Drop zone
        dz = tk.LabelFrame(main, text="Drop Files Here",
                           padx=10, pady=10,
                           bg="#e8f0fe", relief=tk.GROOVE, bd=2)
        dz.pack(fill=tk.X, pady=(0, 6))
        dzi = ttk.Frame(dz)
        dzi.pack(pady=6)
        ttk.Label(dzi,
                  text="📂 Drag & drop files here or click Browse\n"
                       "Auto-routes slope → Supabase, everything else → local",
                  justify=tk.CENTER, font=("Segoe UI", 11)).pack()
        ttk.Label(dzi,
                  text="*_Slope.geojson · *_LCM2025.geojson · *.topojson · *.json · .env · etc.",
                  foreground="#666", font=("Segoe UI", 9)).pack(pady=(2, 0))
        ttk.Button(dzi, text="Browse for Files…",
                   command=self._browse).pack(pady=(6, 0))
        # Enable drag-drop on the whole window
        self.root.drop_target_register(DND_FILES)
        self.root.dnd_bind("<<Drop>>", self._on_drop)

        # Row 2: File list
        lf = ttk.LabelFrame(main, text="Files", padding=4)
        lf.pack(fill=tk.BOTH, expand=True, pady=(0, 6))
        cols = ("#", "File", "Action", "Status")
        self.tree = ttk.Treeview(lf, columns=cols, show="headings",
                                 height=6, selectmode="extended")
        self.tree.heading("#", text="#")
        self.tree.heading("File", text="File")
        self.tree.heading("Action", text="Action")
        self.tree.heading("Status", text="Status")
        self.tree.column("#", width=30, anchor=tk.CENTER)
        self.tree.column("File", width=260, anchor=tk.W)
        self.tree.column("Action", width=240, anchor=tk.W)
        self.tree.column("Status", width=100, anchor=tk.CENTER)
        scroll = ttk.Scrollbar(lf, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        fa = ttk.Frame(main)
        fa.pack(fill=tk.X, pady=(0, 4))
        ttk.Button(fa, text="Remove Selected",
                   command=self._remove_sel).pack(side=tk.LEFT)
        ttk.Button(fa, text="Clear All",
                   command=self._clear_files).pack(side=tk.LEFT, padx=6)
        self.fcount = ttk.Label(fa, text="0 files", foreground="#555")
        self.fcount.pack(side=tk.RIGHT)

        # Row 3: Options
        opts = ttk.LabelFrame(main, text="Options", padding=8)
        opts.pack(fill=tk.X, pady=(0, 6))
        ttk.Label(opts, text="Simplify tol:").pack(side=tk.LEFT)
        ttk.Spinbox(opts, from_=0.0001, to=0.01, increment=0.0001,
                    textvariable=self.tol, width=8).pack(side=tk.LEFT, padx=4)
        ttk.Label(opts, text="Batch:").pack(side=tk.LEFT, padx=(16, 0))
        ttk.Spinbox(opts, from_=1, to=50, increment=1,
                    textvariable=self.batch, width=5).pack(side=tk.LEFT, padx=4)

        # Row 4: Action buttons
        act = ttk.Frame(main)
        act.pack(fill=tk.X, pady=(0, 6))
        self.update_btn = ttk.Button(act, text="1. Update Files",
                                     command=self._on_update)
        self.update_btn.pack(side=tk.LEFT, padx=(0, 8))
        self.deploy_btn = ttk.Button(act, text="2. Build & Deploy to FTP",
                                     command=self._on_deploy)
        self.deploy_btn.pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(act, text="Git Status",
                   command=self._on_git_status).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(act, text="Report Bug",
                   command=self._on_report_bug).pack(side=tk.RIGHT)

        # Row 5: Progress
        prog = ttk.Frame(main)
        prog.pack(fill=tk.X, pady=(0, 4))
        self.pbar = ttk.Progressbar(prog, mode="determinate")
        self.pbar.pack(fill=tk.X, expand=True)
        self.plbl = ttk.Label(prog, text="", foreground="gray")
        self.plbl.pack(anchor=tk.W)

        # Row 6: Log
        lf2 = ttk.LabelFrame(main, text="Log", padding=4)
        lf2.pack(fill=tk.BOTH, expand=True)
        self.log = tk.Text(lf2, height=10, wrap=tk.WORD,
                           font=("Consolas", 9), bg="#fafafa", state=tk.DISABLED)
        ls = ttk.Scrollbar(lf2, command=self.log.yview)
        self.log.configure(yscrollcommand=ls.set)
        ls.pack(side=tk.RIGHT, fill=tk.Y)
        self.log.pack(fill=tk.BOTH, expand=True)

        self.root.bind("<F5>", lambda _: self._test_all())
        self.root.bind("<Control-l>", lambda _: self._clear_log())

    # ──────── File management ────────

    def _on_drop(self, event: tk.Event) -> None:
        raw = event.data
        if not raw:
            return
        # tkinterdnd2 returns paths as: {C:\path\to\a} C:\path\to\b C:\path with spaces\to\c
        # Parse by splitting on spaces while respecting {...} groups
        paths = []
        buf = ""
        in_brace = False
        for ch in raw:
            if ch == "{":
                in_brace = True
                buf = ""
            elif ch == "}":
                in_brace = False
                if buf:
                    paths.append(buf)
                    buf = ""
            elif ch == " " and not in_brace:
                if buf:
                    paths.append(buf)
                    buf = ""
            else:
                buf += ch
        if buf:
            paths.append(buf)
        for p in paths:
            p = p.strip()
            if p:
                self._add(p)

    def _browse(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Select files (any type — Ctrl+click for multiple)",
            filetypes=[("All files", "*.*"), ("GeoJSON", "*.geojson"),
                       ("TopoJSON", "*.topojson"), ("JSON", "*.json")],
        )
        for p in paths:
            self._add(p)

    def _add(self, path: str) -> None:
        if not os.path.isfile(path):
            return
        path = os.path.normpath(path)
        if any(f["path"] == path for f in self.files):
            return
        route = classify_file(path)
        # If .env dropped → load credentials immediately
        if route["action"] == "load credentials":
            load_env(path)
            self._refresh_conn()
            self._writelog(f"✓ Loaded credentials from {path}")
        self.files.append({"path": path, "basename": os.path.basename(path),
                           "route": route, "status": "loaded" if route["action"] == "load credentials" else "ready"})
        self._refresh()

    def _remove_sel(self) -> None:
        sel = self.tree.selection()
        idxs = sorted((int(self.tree.item(i)["values"][0]) - 1)
                      for i in sel if self.tree.exists(i))
        for i in reversed(idxs):
            if 0 <= i < len(self.files):
                self.files.pop(i)
        self._refresh()

    def _clear_files(self) -> None:
        self.files.clear()
        self._refresh()

    def _refresh(self) -> None:
        for row in self.tree.get_children():
            self.tree.delete(row)
        for i, f in enumerate(self.files, 1):
            self.tree.insert("", tk.END, values=(
                i, f["basename"], f["route"]["action"], f["status"]))
        ready = sum(1 for f in self.files if f["status"] == "ready")
        self.fcount.configure(text=f"{len(self.files)} files ({ready} ready)")

    # ──────── Status ────────

    def _refresh_conn(self) -> None:
        supa_ok = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
        ftp_ok = bool(FTP_HOST and FTP_USER and FTP_PASS and FTP_REMOTE_DIR)
        self.conn_lbl.configure(
            text="✓" if supa_ok else "✗ no .env",
            foreground="green" if supa_ok else "red")
        self.ftp_lbl.configure(
            text="✓" if ftp_ok else "✗ no .env",
            foreground="green" if ftp_ok else "red")

    def _test_all(self) -> None:
        self._writelog("═══ Connection Test ═══")
        supa_ok = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
        ftp_ok = bool(FTP_HOST and FTP_USER and FTP_PASS and FTP_REMOTE_DIR)
        if supa_ok:
            try:
                r = requests.get(f"{SUPABASE_URL}/rest/v1/",
                                 headers=_supa_headers(), timeout=10)
                self._writelog(f"  Supabase: {'✓' if r.status_code < 500 else '✗'} ({r.status_code})")
            except Exception as e:
                self._writelog(f"  Supabase: ✗ {e}")
        else:
            self._writelog("  Supabase: ✗ not configured")
        if ftp_ok:
            try:
                ftp = FTP(FTP_HOST, timeout=10)
                ftp.login(FTP_USER, FTP_PASS)
                ftp.quit()
                self._writelog("  FTP: ✓ connected")
            except Exception as e:
                self._writelog(f"  FTP: ✗ {e}")
        else:
            self._writelog("  FTP: ✗ not configured")
        self._refresh_conn()
        self._writelog("═══ Done ═══\n")

    # ──────── Log / progress ────────

    def _writelog(self, msg: str) -> None:
        self.log.configure(state=tk.NORMAL)
        self.log.insert(tk.END, msg + "\n")
        self.log.see(tk.END)
        self.log.configure(state=tk.DISABLED)
        self.root.update_idletasks()

    def _clear_log(self) -> None:
        self.log.configure(state=tk.NORMAL)
        self.log.delete("1.0", tk.END)
        self.log.configure(state=tk.DISABLED)

    def _busy(self, busy: bool) -> None:
        s = tk.DISABLED if busy else tk.NORMAL
        self.update_btn.configure(state=s)
        self.deploy_btn.configure(state=s)
        self.root.update_idletasks()

    # ──────── 1. Update Files ────────

    def _on_update(self) -> None:
        ready = [f for f in self.files if f["status"] == "ready"]
        if not ready:
            messagebox.showinfo("Nothing to do", "No files to update.")
            return
        self._clear_log()
        self._busy(True)
        self.pbar["value"] = 0
        t = threading.Thread(target=self._do_update, args=(ready,), daemon=True)
        t.start()

    def _do_update(self, ready: list[dict]) -> None:
        self._gui_log(f"═══ Updating {len(ready)} file(s) ═══\n")
        tol = self.tol.get()
        batch_size = self.batch.get()
        ok = 0

        for idx, f in enumerate(ready):
            route = f["route"]
            src = f["path"]
            basename = f["basename"]
            self._gui_log(f"[{idx + 1}/{len(ready)}] {basename}")
            self._gui_prog(f"Processing {basename}…")

            # Copy file to destination
            dst_dir = route.get("dest_dir", GEOJSON_ROOT)
            os.makedirs(dst_dir, exist_ok=True)
            dst = os.path.join(dst_dir, basename)
            try:
                shutil.copy2(src, dst)
                self._gui_log(f"  ✓ Copied to {os.path.relpath(dst, PROJECT_ROOT)}")
            except Exception as e:
                self._gui_log(f"  ❌ Copy failed: {e}")
                self._set_status(f, "error")
                continue

            # If it's slope/LCM, also upload to Supabase
            table = route.get("supabase_table")
            basin = route.get("basin_code")
            if table and basin:
                self._gui_log(f"  Uploading {basin} to Supabase {table}…")
                try:
                    with open(src, encoding="utf-8") as fp:
                        geojson = json.load(fp)
                except Exception as e:
                    self._gui_log(f"  ❌ Read error: {e}")
                    self._set_status(f, "error")
                    continue

                features = geojson.get("features", [])
                if not features:
                    self._gui_log("  ⚠ No features, skipping Supabase upload")
                    self._set_status(f, "done (empty)")
                    continue

                rows: list[dict] = []
                for feat in features:
                    props = feat.get("properties", {})
                    geom = feat.get("geometry")
                    if not geom:
                        continue
                    if table == "slope":
                        rows.append({
                            "basin_code": basin,
                            "gridcode": props.get("gridcode", 0),
                            "geom": round_coords(geom, 4),
                        })
                    else:
                        rows.append({
                            "basin_code": basin,
                            "lcm_class": props.get("LCM_CLASS"),
                            "properties": props,
                            "geom": round_coords(geom, 4),
                        })

                if not rows:
                    self._gui_log("  ⚠ No valid geometries, skipping Supabase")
                    self._set_status(f, "done (no geom)")
                    continue

                # Simplify
                if tol > 0:
                    for i2, row in enumerate(rows):
                        simp = simplify_geometry(row["geom"], tol)
                        row["geom_simplified"] = round_coords(simp, 4)
                        self._gui_prog_overall(idx, len(ready),
                                               i2 + 1, len(rows))

                # Delete + insert
                for m in supa_delete(table, basin):
                    self._gui_log(m)
                for m in supa_insert(table, rows, batch_size,
                                     lambda d, t: self._gui_prog_overall(
                                         idx, len(ready), d, t)):
                    self._gui_log(m)

                self._gui_log(f"  ✓ Supabase {table} updated for {basin}")
            else:
                self._gui_log(f"  — No Supabase upload needed")

            self._set_status(f, "done")
            ok += 1

        self._gui_prog("")
        self._gui_log(f"\n═══ Done: {ok}/{len(ready)} files updated ═══")
        self._gui_busy(False)

    # ──────── Git Status ────────

    def _on_git_status(self) -> None:
        self._writelog("═══ Git Status ═══")
        try:
            r = subprocess.run(["git", "status", "--short"],
                               capture_output=True, text=True,
                               cwd=PROJECT_ROOT, timeout=30)
            if r.returncode == 0:
                out = r.stdout.strip()
                self._writelog(out if out else "  ✓ Working tree clean")
            else:
                self._writelog(f"  ⚠ {r.stderr.strip()}")
            # Show branch info too
            r2 = subprocess.run(["git", "branch", "--show-current"],
                                capture_output=True, text=True,
                                cwd=PROJECT_ROOT, timeout=10)
            branch = r2.stdout.strip()
            self._writelog(f"  Branch: {branch}")
        except Exception as e:
            self._writelog(f"  ❌ {e}")
        self._writelog("═══ Done ═══\n")

    # ──────── Report Bug ────────

    def _on_report_bug(self) -> None:
        url = "https://github.com/2241812/geoMonitor/issues/new"
        try:
            webbrowser.open(url)
            self._writelog(f"  Opened {url}")
        except Exception as e:
            self._writelog(f"  ❌ Could not open browser: {e}")

    # ──────── 2. Build & Deploy ────────

    def _on_deploy(self) -> None:
        self._clear_log()
        self._busy(True)
        self.pbar["value"] = 0
        self._gui_prog("Building…")
        t = threading.Thread(target=self._do_deploy, daemon=True)
        t.start()

    def _do_deploy(self) -> None:
        build_and_deploy(self._gui_log)
        self._gui_busy(False)
        self._gui_prog("")

    # ──────── Thread-safe helpers ────────

    def _gui_log(self, msg: str) -> None:
        self.root.after(0, self._writelog, msg)

    def _gui_prog(self, text: str) -> None:
        self.root.after(0, lambda: self.plbl.configure(text=text))

    def _gui_prog_overall(self, fi: int, tf: int, d: int, td: int) -> None:
        pct = int((d / max(td, 1)) * 100)
        self.root.after(0, lambda: self.pbar.configure(value=pct))
        self.root.after(0, lambda: self.plbl.configure(
            text=f"File {fi + 1}/{tf} — {d}/{td}"))

    def _gui_busy(self, busy: bool) -> None:
        self.root.after(0, lambda: self._busy(busy))

    def _set_status(self, f: dict, s: str) -> None:
        f["status"] = s
        self.root.after(0, self._refresh)

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    DeployTool().run()
