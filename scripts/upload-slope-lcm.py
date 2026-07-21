#!/usr/bin/env python3
"""
upload-slope-lcm.py — Drag-and-drop GeoJSON uploader for slope / land cover (LCM).

Drop or select GeoJSON files — the tool auto-detects dataset type and basin
code from the filename pattern:
  *_Slope.geojson     → slope table, basin = prefix
  *_LCM2025.geojson   → lcm table,   basin = prefix

Connects via SUPABASE_URL + SUPABASE_SERVICE_KEY from the project .env file.

Usage:
  pip install requests
  python scripts/upload-slope-lcm.py
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Any, Callable

try:
    import requests
except ImportError:
    messagebox.showerror("Missing dependency", "Run: pip install requests")
    sys.exit(1)

# ── Paths ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
DOT_ENV = os.path.join(PROJECT_ROOT, ".env")
SLOPE_DIR = os.path.join(PROJECT_ROOT, "public", "geoJSON")
LCM_DIR = os.path.join(SLOPE_DIR, "LCM")

SUPABASE_URL: str | None = None
SUPABASE_SERVICE_KEY: str | None = None


# ─────────────────────────────────────────────
#  .env
# ─────────────────────────────────────────────
def load_env() -> None:
    global SUPABASE_URL, SUPABASE_SERVICE_KEY
    if not os.path.isfile(DOT_ENV):
        return
    with open(DOT_ENV, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip("\"'")
            if k == "SUPABASE_URL":
                SUPABASE_URL = v
            elif k == "SUPABASE_SERVICE_KEY":
                SUPABASE_SERVICE_KEY = v


# ─────────────────────────────────────────────
#  Filename → dataset + basin
# ─────────────────────────────────────────────
RE_SLOPE = re.compile(r"^(.+?)_Slope\.geojson$", re.IGNORECASE)
RE_LCM   = re.compile(r"^(.+?)_LCM2025\.geojson$", re.IGNORECASE)


def classify_file(filename: str) -> tuple[str, str] | None:
    """Return (table, basin_code) or None if filename doesn't match."""
    basename = os.path.basename(filename)
    m = RE_SLOPE.match(basename)
    if m:
        return ("slope", m.group(1))
    m = RE_LCM.match(basename)
    if m:
        return ("lcm", m.group(1))
    return None


# ─────────────────────────────────────────────
#  Douglas-Peucker simplification  (pure Python)
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
    """Round all coordinates to *decimals* places (matching seed-*.mjs)."""
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
#  Supabase REST
# ─────────────────────────────────────────────
def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def delete_basin(table: str, basin: str) -> list[str]:
    log: list[str] = []
    url = f"{SUPABASE_URL}/rest/v1/{table}?basin_code=eq.{basin}"
    try:
        r = requests.delete(url, headers=_headers())
        if r.status_code in (200, 204):
            log.append(f"  ✓ Cleared existing {table} data for {basin}")
        else:
            log.append(f"  ⚠ DELETE returned {r.status_code} (may be OK)")
        return log
    except Exception as e:
        return [f"  ❌ DELETE error: {e}"]


def insert_batch(table: str, rows: list[dict],
                 batch_size: int,
                 on_progress: Callable) -> list[str]:
    log: list[str] = []
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    total = len(rows)
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        try:
            r = requests.post(url, headers=_headers(), json=batch)
            ok = r.status_code in (200, 201, 204)
            if not ok and r.status_code == 409:
                log.append(f"  ⚠ Batch {i // batch_size} conflict, skipping")
                continue
            if not ok:
                log.append(f"  ❌ INSERT batch {i // batch_size} "
                           f"({r.status_code}): {r.text[:200]}")
                return log
            n = i // batch_size + 1
            total_batches = math.ceil(total / batch_size)
            log.append(f"  ✓ Batch {n}/{total_batches} ({len(batch)} rows)")
        except Exception as e:
            log.append(f"  ❌ INSERT error batch {i // batch_size}: {e}")
            return log
        on_progress(min(i + batch_size, total), total)
    return log


# ─────────────────────────────────────────────
#  GUI
# ─────────────────────────────────────────────
class UploadTool:
    def __init__(self) -> None:
        load_env()
        self.root = tk.Tk()
        self.root.title("Slope / LCM Upload — Supabase")
        self.root.geometry("820x680")
        self.root.resizable(True, True)

        # colour scheme
        self.root.tk_setPalette(background="#f5f5f5",
                                foreground="#1a1a1a")

        self.files: list[dict] = []            # {path, table, basin, status}
        self.tol = tk.DoubleVar(value=0.0005)
        self.batch = tk.IntVar(value=5)

        self._build_ui()
        self._refresh_conn()

    # ──────── Layout ────────

    def _build_ui(self) -> None:
        main = ttk.Frame(self.root, padding=14)
        main.pack(fill=tk.BOTH, expand=True)

        # ---- Row 0: connection ----
        top = ttk.Frame(main)
        top.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(top, text="Supabase:").pack(side=tk.LEFT)
        self.conn_lbl = ttk.Label(top, text="⏳", foreground="gray")
        self.conn_lbl.pack(side=tk.LEFT, padx=6)
        ttk.Button(top, text="Test", command=self._test_conn,
                   width=8).pack(side=tk.RIGHT)

        # ---- Row 1: drop zone ----
        dz = tk.LabelFrame(main, text="Drop GeoJSON Files",
                           padx=10, pady=10,
                           bg="#e8f0fe", relief=tk.GROOVE, bd=2)
        dz.pack(fill=tk.X, pady=(0, 8))
        dz_inner = ttk.Frame(dz)
        dz_inner.pack(pady=6)
        ttk.Label(dz_inner,
                  text="📂 Drag files onto this window\n"
                       "or click Browse to select",
                  justify=tk.CENTER,
                  font=("Segoe UI", 11)).pack()
        ttk.Label(dz_inner,
                  text='Expected:  ABR_Slope.geojson  ·  ABR_LCM2025.geojson',
                  foreground="#666",
                  font=("Segoe UI", 9)).pack(pady=(4, 0))
        ttk.Button(dz_inner, text="Browse for GeoJSON Files…",
                   command=self._browse).pack(pady=(6, 0))
        # Bind the whole frame & children for drag
        for widget in (dz, dz_inner, dz.winfo_children()[0]):
            widget.bind("<Drop>", self._on_drop)
            widget.bind("<ButtonPress-1>", self._on_drop_click)
        self.root.bind("<Drop>", self._on_drop)

        # ---- Row 2: file list ----
        list_frame = ttk.LabelFrame(main, text="Files to Upload", padding=4)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 8))
        cols = ("#", "File", "Dataset", "Basin", "Status")
        self.tree = ttk.Treeview(list_frame, columns=cols, show="headings",
                                 height=6, selectmode="extended")
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=60, anchor=tk.CENTER)
        self.tree.column("#", width=30)
        self.tree.column("File", width=250, anchor=tk.W)
        self.tree.column("Dataset", width=70)
        self.tree.column("Basin", width=60)
        self.tree.column("Status", width=120)
        scroll = ttk.Scrollbar(list_frame, orient=tk.VERTICAL,
                               command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        # file-list action buttons
        fl_actions = ttk.Frame(main)
        fl_actions.pack(fill=tk.X, pady=(0, 6))
        ttk.Button(fl_actions, text="Remove Selected",
                   command=self._remove_selected).pack(side=tk.LEFT)
        ttk.Button(fl_actions, text="Clear All",
                   command=self._clear_files).pack(side=tk.LEFT, padx=6)
        self.file_count_lbl = ttk.Label(fl_actions, text="0 files",
                                        foreground="#555")
        self.file_count_lbl.pack(side=tk.RIGHT)

        # ---- Row 3: options ----
        opts = ttk.LabelFrame(main, text="Options", padding=8)
        opts.pack(fill=tk.X, pady=(0, 6))
        ttk.Label(opts, text="Simplify tolerance:").pack(side=tk.LEFT)
        ttk.Spinbox(opts, from_=0.0001, to=0.01, increment=0.0001,
                    textvariable=self.tol, width=8).pack(side=tk.LEFT, padx=4)
        ttk.Label(opts, text="Batch size:").pack(side=tk.LEFT, padx=(20, 0))
        ttk.Spinbox(opts, from_=1, to=50, increment=1,
                    textvariable=self.batch, width=5).pack(side=tk.LEFT, padx=4)

        # ---- Row 4: upload ----
        act = ttk.Frame(main)
        act.pack(fill=tk.X, pady=(0, 6))
        self.upload_btn = ttk.Button(act, text="Upload All",
                                     command=self._on_upload)
        self.upload_btn.pack(side=tk.RIGHT)

        # ---- Row 5: progress ----
        prog = ttk.Frame(main)
        prog.pack(fill=tk.X, pady=(0, 4))
        self.pbar = ttk.Progressbar(prog, mode="determinate")
        self.pbar.pack(fill=tk.X, expand=True)
        self.plbl = ttk.Label(prog, text="", foreground="gray")
        self.plbl.pack(anchor=tk.W)

        # ---- Row 6: log ----
        log_frame = ttk.LabelFrame(main, text="Log", padding=4)
        log_frame.pack(fill=tk.BOTH, expand=True)
        self.log = tk.Text(log_frame, height=10, wrap=tk.WORD,
                           font=("Consolas", 9), bg="#fafafa",
                           state=tk.DISABLED)
        ls = ttk.Scrollbar(log_frame, command=self.log.yview)
        self.log.configure(yscrollcommand=ls.set)
        ls.pack(side=tk.RIGHT, fill=tk.Y)
        self.log.pack(fill=tk.BOTH, expand=True)

        # quick bind F5 to test, Ctrl+L to clear log
        self.root.bind("<F5>", lambda _: self._test_conn())
        self.root.bind("<Control-l>", lambda _: self._clear_log())

    # ──────── File management ────────

    def _browse(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Select GeoJSON files (Ctrl+click for multiple)",
            filetypes=[("GeoJSON", "*.geojson"), ("All files", "*.*")],
        )
        for p in paths:
            self._add_file(p)

    def _on_drop(self, event: tk.Event) -> None:
        """Handle file drop (tkinterdnd2 protocol if available, else noop)."""
        raw = getattr(event, "data", None) or ""
        for path in raw.split() if raw else []:
            self._add_file(path.strip("{}"))

    def _on_drop_click(self, event: tk.Event) -> None:
        """Click on drop zone acts as browse."""
        self._browse()

    def _add_file(self, path: str) -> None:
        if not os.path.isfile(path):
            return
        # normalise
        path = os.path.normpath(path)
        if any(f["path"] == path for f in self.files):
            return
        info = classify_file(path)
        if info is None:
            self.files.append({"path": path, "table": "?",
                               "basin": "?", "status": "skipped (bad name)"})
        else:
            self.files.append({"path": path, "table": info[0],
                               "basin": info[1], "status": "ready"})
        self._refresh_list()

    def _remove_selected(self) -> None:
        sel = self.tree.selection()
        idxs = sorted((int(self.tree.item(i)["values"][0]) - 1)
                      for i in sel if self.tree.exists(i))
        for i in reversed(idxs):
            if 0 <= i < len(self.files):
                self.files.pop(i)
        self._refresh_list()

    def _clear_files(self) -> None:
        self.files.clear()
        self._refresh_list()

    def _refresh_list(self) -> None:
        for row in self.tree.get_children():
            self.tree.delete(row)
        for i, f in enumerate(self.files, 1):
            self.tree.insert("", tk.END, values=(
                i, os.path.basename(f["path"]),
                f["table"], f["basin"], f["status"]))
        ready = sum(1 for f in self.files if f["status"] == "ready")
        self.file_count_lbl.configure(text=f"{len(self.files)} files ({ready} ready)")

    # ──────── Connection ────────

    def _refresh_conn(self) -> None:
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            self.conn_lbl.configure(text="✓ configured", foreground="green")
        else:
            self.conn_lbl.configure(
                text="✗ missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env",
                foreground="red")

    def _test_conn(self) -> None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            messagebox.showerror("Not configured",
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
            return
        self._writelog("Testing Supabase connection…")
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/",
                             headers=_headers(), timeout=10)
            if r.status_code < 500:
                self._writelog("  ✓ Connected")
                self.conn_lbl.configure(text="✓ connected", foreground="green")
            else:
                self._writelog(f"  ❌ {r.status_code}: {r.text[:200]}")
        except Exception as e:
            self._writelog(f"  ❌ {e}")

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

    def _set_busy(self, busy: bool) -> None:
        self.upload_btn.configure(state=tk.DISABLED if busy else tk.NORMAL)
        self.root.update_idletasks()

    # ──────── Upload ────────

    def _on_upload(self) -> None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            messagebox.showerror("Not configured",
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
            return
        ready = [f for f in self.files if f["status"] == "ready"]
        if not ready:
            messagebox.showinfo("Nothing to upload",
                "Drop or select GeoJSON files first.")
            return

        self._clear_log()
        self._set_busy(True)
        self.pbar["value"] = 0
        t = threading.Thread(target=self._do_upload_all, args=(ready,),
                             daemon=True)
        t.start()

    def _do_upload_all(self, ready: list[dict]) -> None:
        self._gui_log(f"═══ Uploading {len(ready)} file(s) ═══\n")
        tol = self.tol.get()
        batch_size = self.batch.get()
        ok_count = 0

        for idx, f in enumerate(ready):
            path = f["path"]
            table = f["table"]
            basin = f["basin"]

            self._gui_log(f"[{idx + 1}/{len(ready)}] {os.path.basename(path)}")
            self._gui_prog(f"Processing {os.path.basename(path)}…")

            try:
                with open(path, encoding="utf-8") as fp:
                    geojson = json.load(fp)
            except Exception as e:
                self._gui_log(f"  ❌ Read error: {e}")
                self._update_status(f, "error (read)")
                continue

            features = geojson.get("features", [])
            if not features:
                self._gui_log("  ❌ No features, skipping")
                self._update_status(f, "empty")
                continue
            self._gui_log(f"  ✓ {len(features)} features")

            # build rows
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
                self._gui_log("  ❌ No valid geometries, skipping")
                self._update_status(f, "error (no geom)")
                continue

            # simplify
            if tol > 0:
                self._gui_log(f"  Simplifying (RDP {tol})…")
                for i, row in enumerate(rows):
                    simp = simplify_geometry(row["geom"], tol)
                    row["geom_simplified"] = round_coords(simp, 4)
                    self._gui_prog_overall(idx, len(ready), i + 1, len(rows))

            # delete existing
            self._gui_log(f"  Clearing existing {basin} {table} data…")
            for m in delete_basin(table, basin):
                self._gui_log(m)

            # insert
            self._gui_log(f"  Inserting {len(rows)} rows (batch={batch_size})…")

            def _on_progress(done: int, total: int) -> None:
                self._gui_prog_overall(idx, len(ready), done, total)

            errs = insert_batch(table, rows, batch_size, _on_progress)
            for m in errs:
                self._gui_log(m)
            if any(m.startswith("  ❌") for m in errs):
                self._update_status(f, "error")
                continue

            # write back
            out_dir = LCM_DIR if table == "lcm" else SLOPE_DIR
            os.makedirs(out_dir, exist_ok=True)
            suffix = "_LCM2025" if table == "lcm" else "_Slope"
            out_path = os.path.join(out_dir, f"{basin}{suffix}.geojson")
            with open(out_path, "w", encoding="utf-8") as fp:
                json.dump(geojson, fp)
            self._gui_log(f"  ✓ Written to {out_path}")
            self._gui_log(f"  ✅ Done — {len(rows)} features\n")
            self._update_status(f, "done")
            ok_count += 1

        self._gui_prog("")
        self._gui_log(
            f"═══ Finished: {ok_count}/{len(ready)} uploaded ═══")
        self._gui_busy(False)

    # ──────── Thread-safe GUI updates ────────

    def _gui_log(self, msg: str) -> None:
        self.root.after(0, self._writelog, msg)

    def _gui_prog(self, text: str) -> None:
        self.root.after(0, lambda: self.plbl.configure(text=text))

    def _gui_prog_overall(self, file_idx: int, total_files: int,
                          done: int, total_done: int) -> None:
        pct = int((done / max(total_done, 1)) * 100)
        self.root.after(0, lambda: self.pbar.configure(value=pct))
        self.root.after(0, lambda: self.plbl.configure(
            text=f"File {file_idx + 1}/{total_files} — {done}/{total_done}"))

    def _gui_busy(self, busy: bool) -> None:
        self.root.after(0, lambda: self._set_busy(busy))

    def _update_status(self, f: dict, status: str) -> None:
        f["status"] = status
        self.root.after(0, self._refresh_list)

    # ──────── Run ────────

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    UploadTool().run()
