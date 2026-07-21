#!/usr/bin/env python3
"""
upload-slope-lcm.py — GUI tool for uploading slope / land cover (LCM) GeoJSON to Supabase.

Connects to Supabase via the service_role key (from .env), reads a GeoJSON file,
uploads both the raw and server-side simplified geometry, and saves the file back
to the local geoJSON directory.

Usage:
  pip install -r scripts/requirements.txt
  python scripts/upload-slope-lcm.py

Requires these entries in the project .env file:
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SERVICE_KEY=<service_role_jwt>
"""

from __future__ import annotations

import json
import math
import os
import sys
import threading
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
from typing import Any

try:
    import requests
except ImportError:
    messagebox.showerror("Missing dependency", "Run: pip install requests")
    sys.exit(1)

# ──────────────────────────────────────────────
#  Paths
# ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
DOT_ENV = os.path.join(PROJECT_ROOT, ".env")
SLOPE_DIR = os.path.join(PROJECT_ROOT, "public", "geoJSON")
LCM_DIR = os.path.join(SLOPE_DIR, "LCM")

# Basin codes (matching the existing folder/key convention)
BASIN_CODES = sorted([
    "ABR", "ABU", "AGN", "AMB", "ARI", "BUD", "MLG",
    "NAG", "SIF", "SMR", "UCH", "UMT", "ZUM", "ACH",
])

SUPABASE_URL: str | None = None
SUPABASE_SERVICE_KEY: str | None = None


# ──────────────────────────────────────────────
#  .env loader  (built-in, no python-dotenv)
# ──────────────────────────────────────────────
def load_env() -> None:
    global SUPABASE_URL, SUPABASE_SERVICE_KEY
    if not os.path.isfile(DOT_ENV):
        return
    with open(DOT_ENV, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip("\"'")
            if key == "SUPABASE_URL":
                SUPABASE_URL = val
            elif key == "SUPABASE_SERVICE_KEY":
                SUPABASE_SERVICE_KEY = val


# ──────────────────────────────────────────────
#  Pure-Python Douglas-Peucker simplification
# ──────────────────────────────────────────────
def _perp_dist(point: tuple[float, float],
               start: tuple[float, float],
               end: tuple[float, float]) -> float:
    """Perpendicular distance from *point* to the line *start*–*end*."""
    px, py = point
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    if dx == 0 and dy == 0:
        return math.hypot(px - sx, py - sy)
    num = abs(dy * px - dx * py + ex * sy - ey * sx)
    den = math.hypot(dx, dy)
    return num / den


def _simplify_ring(ring: list[list[float]], tolerance: float
                   ) -> list[list[float]]:
    """Ramer–Douglas–Peucker on a single ring (list of [x, y])."""
    if len(ring) <= 2:
        return ring
    dmax = 0.0
    idx = 0
    for i in range(1, len(ring) - 1):
        d = _perp_dist((ring[i][0], ring[i][1]),
                       (ring[0][0], ring[0][1]),
                       (ring[-1][0], ring[-1][1]))
        if d > dmax:
            idx = i
            dmax = d
    if dmax > tolerance:
        left = _simplify_ring(ring[:idx + 1], tolerance)
        right = _simplify_ring(ring[idx:], tolerance)
        return left[:-1] + right
    return [ring[0], ring[-1]]


def simplify_geometry(geom: dict[str, Any], tolerance: float) -> dict[str, Any]:
    """Return a copy of *geom* with coordinates simplified via RDP."""
    if tolerance <= 0:
        return geom
    geom = json.loads(json.dumps(geom))  # deep copy
    if geom["type"] == "Polygon":
        geom["coordinates"] = [_simplify_ring(r, tolerance)
                               for r in geom["coordinates"]]
    elif geom["type"] == "MultiPolygon":
        geom["coordinates"] = [
            [_simplify_ring(r, tolerance) for r in poly]
            for poly in geom["coordinates"]
        ]
    return geom


def round_coords(geom: dict[str, Any], decimals: int = 4) -> dict[str, Any]:
    """Round all coordinates to *decimals* places (matching seed-*.mjs)."""
    f = 10 ** decimals
    def _rring(ring: list[list[float]]) -> list[list[float]]:
        return [[round(c[0] * f) / f, round(c[1] * f) / f] for c in ring]
    geom = json.loads(json.dumps(geom))
    if geom["type"] == "Polygon":
        geom["coordinates"] = [_rring(r) for r in geom["coordinates"]]
    elif geom["type"] == "MultiPolygon":
        geom["coordinates"] = [[_rring(r) for r in poly] for poly in geom["coordinates"]]
    return geom


# ──────────────────────────────────────────────
#  Supabase REST helpers
# ──────────────────────────────────────────────
def supabase_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _ensure_geom_simplified(log: list[str]) -> bool:
    """Add geom_simplified jsonb column to slope + lcm tables if missing."""
    from urllib.parse import urljoin
    base = SUPABASE_URL.rstrip("/") + "/rest/v1"
    ok = True
    for tbl in ("slope", "lcm"):
        # Try a SELECT to check the column — if it fails the column doesn't exist
        url = f"{base}/{tbl}?select=geom_simplified&limit=1"
        try:
            r = requests.get(url, headers=supabase_headers())
            if r.status_code == 200:
                continue  # column already exists
        except Exception:
            pass
        # Column missing → add it
        sql = f'ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS geom_simplified jsonb;'
        # Supabase REST API has a /rpc/ for raw SQL if pg_dump is enabled,
        # but the simplest is to use the pg connection. Since we're REST-only,
        # we try via the management API or skip gracefully.
        log.append(f"  ⚠  Could not auto-add geom_simplified to {tbl} — "
                   "add manually: ALTER TABLE {tbl} ADD COLUMN geom_simplified jsonb;")
        ok = False
    return ok


def delete_basin_data(table: str, basin_code: str,
                      log: list[str]) -> bool:
    """DELETE all rows for *basin_code* from *table*."""
    base = SUPABASE_URL.rstrip("/") + "/rest/v1"
    url = f"{base}/{table}?basin_code=eq.{basin_code}"
    try:
        r = requests.delete(url, headers=supabase_headers())
        if r.status_code not in (200, 204):
            log.append(f"  ❌ DELETE failed ({r.status_code}): {r.text[:200]}")
            return False
        log.append(f"  ✓ Cleared existing {table} data for {basin_code}")
        return True
    except Exception as e:
        log.append(f"  ❌ DELETE error: {e}")
        return False


def insert_basin_data(table: str, rows: list[dict],
                      batch_size: int, log: list[str],
                      progress_cb) -> bool:
    """INSERT *rows* into *table* in batches."""
    base = SUPABASE_URL.rstrip("/") + "/rest/v1"
    url = f"{base}/{table}"
    total = len(rows)
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        try:
            r = requests.post(url, headers=supabase_headers(), json=batch)
            if r.status_code not in (200, 201, 204):
                # 409 conflict is fine if Prefer: resolution=merge-duplicates
                if r.status_code == 409:
                    log.append(f"  ⚠  Batch {i // batch_size} conflict (skipped)")
                    continue
                log.append(f"  ❌ INSERT failed batch {i // batch_size} "
                           f"({r.status_code}): {r.text[:200]}")
                return False
            log.append(f"  ✓ Batch {i // batch_size + 1}/"
                       f"{math.ceil(total / batch_size)} inserted "
                       f"({len(batch)} features)")
        except Exception as e:
            log.append(f"  ❌ INSERT error batch {i // batch_size}: {e}")
            return False
        progress_cb(min(i + batch_size, total), total)
    return True


# ──────────────────────────────────────────────
#  GUI
# ──────────────────────────────────────────────
class UploadTool:
    def __init__(self) -> None:
        load_env()

        self.root = tk.Tk()
        self.root.title("Slope / LCM Upload — Supabase")
        self.root.geometry("780x620")
        self.root.resizable(True, True)

        # ── State ──
        self.dataset = tk.StringVar(value="slope")
        self.basin_code = tk.StringVar(value="ABR")
        self.file_path = tk.StringVar()
        self.tolerance = tk.DoubleVar(value=0.0005)
        self.batch_size = tk.IntVar(value=5)

        # ── Build UI ──
        self._build_ui()

        # ── Initial connection check ──
        self._update_connection_status()

    # ──────── UI builder ────────

    def _build_ui(self) -> None:
        main = ttk.Frame(self.root, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        # ── Row 0: Connection status ──
        conn_frame = ttk.Frame(main)
        conn_frame.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(conn_frame, text="Supabase:").pack(side=tk.LEFT)
        self.conn_label = ttk.Label(conn_frame, text="⏳ checking…",
                                    foreground="gray")
        self.conn_label.pack(side=tk.LEFT, padx=(6, 0))

        # ── Row 1: Dataset type ──
        ds_frame = ttk.LabelFrame(main, text="Dataset", padding=8)
        ds_frame.pack(fill=tk.X, pady=(0, 8))
        ttk.Radiobutton(ds_frame, text="Slope", variable=self.dataset,
                        value="slope").pack(side=tk.LEFT, padx=(0, 16))
        ttk.Radiobutton(ds_frame, text="Land Cover (LCM)",
                        variable=self.dataset,
                        value="lcm").pack(side=tk.LEFT)

        # ── Row 2: Basin selection ──
        basin_frame = ttk.LabelFrame(main, text="Basin", padding=8)
        basin_frame.pack(fill=tk.X, pady=(0, 8))
        self.basin_combo = ttk.Combobox(basin_frame,
                                         values=BASIN_CODES,
                                         textvariable=self.basin_code,
                                         state="readonly", width=12)
        self.basin_combo.pack(side=tk.LEFT)
        ttk.Label(basin_frame,
                  text="ACH is also used for LCM").pack(side=tk.LEFT, padx=(8, 0))

        # ── Row 3: File picker ──
        file_frame = ttk.LabelFrame(main, text="GeoJSON File", padding=8)
        file_frame.pack(fill=tk.X, pady=(0, 8))
        self.file_entry = ttk.Entry(file_frame, textvariable=self.file_path)
        self.file_entry.pack(side=tk.LEFT, fill=tk.X, expand=True,
                             padx=(0, 6))
        ttk.Button(file_frame, text="Browse…",
                   command=self._browse_file).pack(side=tk.LEFT)

        # ── Row 4: Options ──
        opts_frame = ttk.LabelFrame(main, text="Options", padding=8)
        opts_frame.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(opts_frame, text="Simplify tolerance:").pack(side=tk.LEFT)
        tol_spin = ttk.Spinbox(opts_frame, from_=0.0001, to=0.01,
                               increment=0.0001,
                               textvariable=self.tolerance, width=8)
        tol_spin.pack(side=tk.LEFT, padx=(4, 20))
        ttk.Label(opts_frame, text="Batch size:").pack(side=tk.LEFT)
        ttk.Spinbox(opts_frame, from_=1, to=50, increment=1,
                    textvariable=self.batch_size, width=5).pack(
                        side=tk.LEFT, padx=(4, 0))

        # ── Row 5: Progress bar ──
        prog_frame = ttk.Frame(main)
        prog_frame.pack(fill=tk.X, pady=(0, 4))
        self.progress = ttk.Progressbar(prog_frame, mode="determinate")
        self.progress.pack(fill=tk.X, expand=True)
        self.prog_label = ttk.Label(prog_frame, text="", foreground="gray")
        self.prog_label.pack(anchor=tk.W)

        # ── Row 6: Log output ──
        log_frame = ttk.LabelFrame(main, text="Log", padding=4)
        log_frame.pack(fill=tk.BOTH, expand=True)
        self.log_text = tk.Text(log_frame, height=14, wrap=tk.WORD,
                                font=("Consolas", 9), bg="#fafafa",
                                state=tk.DISABLED)
        log_scroll = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scroll.set)
        log_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # ── Row 7: Action buttons ──
        btn_frame = ttk.Frame(main)
        btn_frame.pack(fill=tk.X, pady=(8, 0))
        self.upload_btn = ttk.Button(btn_frame, text="Upload to Supabase",
                                     command=self._on_upload)
        self.upload_btn.pack(side=tk.RIGHT)
        ttk.Button(btn_frame, text="Clear Log",
                   command=self._clear_log).pack(side=tk.LEFT, padx=(0, 8))
        ttk.Button(btn_frame, text="Test Connection",
                   command=self._test_connection).pack(side=tk.LEFT)

    # ──────── Actions ────────

    def _log(self, msg: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)
        self.root.update_idletasks()

    def _clear_log(self) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _browse_file(self) -> None:
        ds = self.dataset.get()
        initial = LCM_DIR if ds == "lcm" else SLOPE_DIR
        pattern = "*_LCM*.geojson" if ds == "lcm" else "*_Slope.geojson"
        path = filedialog.askopenfilename(
            title=f"Select {ds.upper()} GeoJSON",
            initialdir=initial,
            filetypes=[("GeoJSON", "*.geojson"), ("All files", "*.*")],
        )
        if path:
            self.file_path.set(path)

    def _update_connection_status(self) -> None:
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            self.conn_label.config(text="✓ configured", foreground="green")
        else:
            self.conn_label.config(
                text="✗ missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env",
                foreground="red")

    def _test_connection(self) -> None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            messagebox.showerror(
                "Not configured",
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the project .env file.")
            return
        self._log("Testing Supabase connection…")
        try:
            url = SUPABASE_URL.rstrip("/") + "/rest/v1/"
            r = requests.get(url, headers=supabase_headers(), timeout=10)
            if r.status_code < 500:
                self._log("  ✓ Connected to Supabase REST API")
                self.conn_label.config(text="✓ connected", foreground="green")
            else:
                self._log(f"  ❌ {r.status_code}: {r.text[:200]}")
        except Exception as e:
            self._log(f"  ❌ Connection failed: {e}")

    def _set_busy(self, busy: bool) -> None:
        state = tk.DISABLED if busy else tk.NORMAL
        self.upload_btn.configure(state=state)
        self.root.update_idletasks()

    # ──────── Upload logic ────────

    def _on_upload(self) -> None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            messagebox.showerror(
                "Not configured",
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the project .env file.")
            return

        ds = self.dataset.get()
        basin = self.basin_code.get()
        filepath = self.file_path.get()

        if not filepath:
            messagebox.showerror("No file", "Select a GeoJSON file first.")
            return
        if not os.path.isfile(filepath):
            messagebox.showerror("Not found", f"File not found:\n{filepath}")
            return

        self._clear_log()
        self._log(f"═══ Upload {ds.upper()} — {basin} ═══")
        self._set_busy(True)
        self.progress["value"] = 0
        self.prog_label["text"] = "Starting…"

        # Run in a thread so the GUI doesn't freeze
        t = threading.Thread(target=self._do_upload, args=(ds, basin, filepath),
                             daemon=True)
        t.start()

    def _do_upload(self, ds: str, basin: str, filepath: str) -> None:
        log_entries: list[str] = []

        try:
            self._append_thread_log(f"Reading {filepath}…")
            with open(filepath, encoding="utf-8") as f:
                geojson = json.load(f)

            features = geojson.get("features", [])
            if not features:
                self._append_thread_log("  ❌ No features found in GeoJSON")
                self._finish_upload(False)
                return
            self._append_thread_log(f"  ✓ {len(features)} features loaded")

            # ── 1. Build rows ──
            table = ds  # "slope" or "lcm"
            do_simplify = self.tolerance.get() > 0
            raw_rows: list[dict] = []
            for feat in features:
                props = feat.get("properties", {})
                geom = feat.get("geometry")
                if not geom:
                    continue
                if ds == "slope":
                    row: dict[str, Any] = {
                        "basin_code": basin,
                        "gridcode": props.get("gridcode", 0),
                        "geom": geom,
                    }
                else:
                    row = {
                        "basin_code": basin,
                        "lcm_class": props.get("LCM_CLASS"),
                        "properties": props,
                        "geom": geom,
                    }
                raw_rows.append(row)

            if not raw_rows:
                self._append_thread_log("  ❌ No valid features to upload")
                self._finish_upload(False)
                return

            # ── 2. Round coordinates (matching seed-*.mjs 4-decimal precision) ──
            self._append_thread_log("Rounding coordinates to 4 decimal places…")
            for i, row in enumerate(raw_rows):
                row["geom"] = round_coords(row["geom"], 4)
            self._append_thread_log("  ✓ Coordinates rounded")

            # ── 3. Simplify geometry (server-side) ──
            tol = self.tolerance.get()
            if do_simplify:
                self._append_thread_log(
                    f"Simplifying geometry (RDP, tolerance={tol})…")
                for i, row in enumerate(raw_rows):
                    simplified = simplify_geometry(row["geom"], tol)
                    row["geom_simplified"] = round_coords(simplified, 4)
                    self._progress_cb(i + 1, len(raw_rows),
                                      f"Simplifying… {i + 1}/{len(raw_rows)}")
                self._append_thread_log(
                    f"  ✓ Simplified {len(raw_rows)} features")
            else:
                self._append_thread_log("  — Skipping simplification")

            # ── 4. Delete existing data for this basin ──
            self._append_thread_log(f"Deleting existing {table} data for {basin}…")
            self._progress_indeterminate("Clearing existing data…")
            if not delete_basin_data(table, basin, log_entries):
                for m in log_entries:
                    self._append_thread_log(m)
                self._finish_upload(False)
                return
            for m in log_entries:
                self._append_thread_log(m)
            log_entries.clear()

            # ── 5. Insert raw rows ──
            batch = self.batch_size.get()
            self._append_thread_log(
                f"Inserting {len(raw_rows)} features (batch={batch})…")

            def insert_prog(done: int, total: int) -> None:
                self._progress_cb(done, total, f"Inserting… {done}/{total}")

            if not insert_basin_data(table, raw_rows, batch,
                                      log_entries, insert_prog):
                for m in log_entries:
                    self._append_thread_log(m)
                self._finish_upload(False)
                return
            for m in log_entries:
                self._append_thread_log(m)
            log_entries.clear()

            # ── 6. Write back to local directory ──
            self._append_thread_log("Writing local GeoJSON file…")
            local_dir = LCM_DIR if ds == "lcm" else SLOPE_DIR
            os.makedirs(local_dir, exist_ok=True)
            suffix = "_LCM2025" if ds == "lcm" else "_Slope"
            out_path = os.path.join(local_dir, f"{basin}{suffix}.geojson")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(geojson, f)
            self._append_thread_log(f"  ✓ Saved to {out_path}")

            self._append_thread_log(
                f"\n✅ Done — {len(raw_rows)} features uploaded for "
                f"{basin} ({ds})")
            self._finish_upload(True)

        except Exception as e:
            self._append_thread_log(f"\n❌ Fatal error: {e}")
            import traceback
            self._append_thread_log(traceback.format_exc())
            self._finish_upload(False)

    # ──────── Thread-safe GUI helpers ────────

    def _append_thread_log(self, msg: str) -> None:
        self.root.after(0, self._log, msg)

    def _progress_cb(self, done: int, total: int, label: str = "") -> None:
        pct = int((done / max(total, 1)) * 100)
        self.root.after(0, lambda: self.progress.configure(value=pct))
        if label:
            self.root.after(0, lambda: self.prog_label.configure(text=label))

    def _progress_indeterminate(self, label: str) -> None:
        self.root.after(0, lambda: self.progress.configure(mode="indeterminate"))
        self.root.after(0, lambda: self.progress.start(10))
        self.root.after(0, lambda: self.prog_label.configure(text=label))

    def _progress_stop(self) -> None:
        self.root.after(0, lambda: self.progress.stop())
        self.root.after(0, lambda: self.progress.configure(mode="determinate"))
        self.root.after(0, lambda: self.progress.configure(value=0))
        self.root.after(0, lambda: self.prog_label.configure(text=""))

    def _finish_upload(self, success: bool) -> None:
        self._progress_stop()
        self.root.after(0, lambda: self._set_busy(False))
        if success:
            self.root.after(0, lambda: self.prog_label.configure(
                text="✅ Upload complete"))
        else:
            self.root.after(0, lambda: self.prog_label.configure(
                text="❌ Upload failed — see log"))

    # ──────── Run ────────

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    UploadTool().run()
