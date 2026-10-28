#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# MacOS_Start.command
# ---------------------------------------------------------------------------
#  macOS/Linux launcher for the Snapgent bridge.
#  Double-clickable in Finder (that is why it is a .command, not a .sh: a .sh
#  opens in an editor instead of running). It finds Python, ensures the one
#  required library is installed, frees a previous bridge still holding the
#  port, then runs a native `bridge` binary or bridge.py. The repository's
#  bridge.exe is Windows-only and is not used.
#  The Windows equivalent is start.bat.
# ---------------------------------------------------------------------------
set -u

# Run from the folder this script lives in, so bridge.py is found regardless of
# where Finder launched it from.
cd "$(dirname "$0")" || exit 1

BRIDGE_PORT="${ZS_BRIDGE_PORT:-17613}"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/start.log"
mkdir -p "$LOG_DIR" 2>/dev/null

log() {
    # Best-effort append; never abort the launch if logging fails.
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$LOG_FILE" 2>/dev/null || true
}

pause_and_exit() {
    # A double-clicked .command opens a fresh Terminal window; without this the
    # window closes instantly and any error scrolls away unread.
    echo
    read -n 1 -s -r -p "Press any key to close this window..."
    echo
    exit "${1:-0}"
}

echo
echo "  === Snapgent Bridge ==="
echo
log "===== MacOS_Start.command launched ====="

# --- 0. bridge.py must be next to us ---------------------------------------
# If the user ran this out of a half-extracted download, bridge.py is missing
# and Python would fail with a confusing error. Say the real thing instead.
BRIDGE_BIN=""
if [ -x "./bridge" ]; then BRIDGE_BIN="./bridge"; fi
if [ -z "$BRIDGE_BIN" ] && [ ! -f "bridge.py" ]; then
    echo "  ERROR: no macOS/Linux bridge binary or bridge.py was found."
    if [ -f "bridge.exe" ]; then
        echo "  bridge.exe is a Windows executable and cannot run on macOS/Linux."
    fi
    echo "  This repository currently includes only the Windows bridge executable."
    echo "  Use Windows, or provide a native ./bridge binary or bridge.py first."
    log "FATAL: no macOS/Linux bridge binary or bridge.py found."
    pause_and_exit 1
fi

# --- 1. Find a usable Python (3.9+ with a working pip) ----------------------
echo "  [1/3] Looking for Python 3.9+..."
PY=""
py_ok() {
    command -v "$1" >/dev/null 2>&1 || return 1
    "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1
}
for cand in python3 python; do
    if py_ok "$cand"; then
        PY="$cand"
        break
    fi
done

if [ -z "$PY" ]; then
    echo "  ERROR: Python 3.9 or newer was not found."
    echo "  Install it from https://www.python.org/downloads/ then run this again."
    echo "  (On macOS you can also run:  xcode-select --install)"
    log "FATAL: no Python 3.9+ found."
    pause_and_exit 1
fi
PY_VER="$("$PY" --version 2>&1)"
echo "        Found: $PY ($PY_VER)"
log "Python found: $PY ($PY_VER)"

# --- 2. Ensure the websockets library is installed --------------------------
echo "  [2/3] Checking websockets library..."
if ! "$PY" -c "import websockets" >/dev/null 2>&1; then
    echo "        Installing websockets - first time only..."
    log "websockets missing, installing via pip --user."
    if ! "$PY" -m pip install --user websockets >/dev/null 2>&1; then
        # Newer macOS Pythons (Homebrew / python.org) mark the environment as
        # externally managed (PEP 668) and refuse --user. Retry allowing it,
        # since this is the user's own machine and a single small pure-Python
        # dependency, not a system package.
        log "pip --user failed; retrying with --break-system-packages."
        "$PY" -m pip install --user --break-system-packages websockets >/dev/null 2>&1 || true
    fi
    if ! "$PY" -c "import websockets" >/dev/null 2>&1; then
        echo
        echo "  ERROR: could not install the 'websockets' library automatically."
        echo "  Install it yourself, then run this again:"
        echo "      $PY -m pip install --user websockets"
        log "FATAL: websockets install failed."
        pause_and_exit 1
    fi
fi
echo "        OK"
log "websockets library OK."

# --- 2.5. Ensure config.json points mcpServers.vscode to local vscode_mcp.py ---
if [ -f "vscode_mcp.py" ]; then
    "$PY" -c '
import json, pathlib, sys
cfg_path = pathlib.Path("config.json")
py_cmd = sys.argv[1]
mcp_py = str(pathlib.Path("vscode_mcp.py").resolve())
try:
    cfg = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.is_file() else {}
except Exception:
    cfg = {}
if not isinstance(cfg, dict):
    cfg = {}
servers = cfg.setdefault("mcpServers", {})
if not isinstance(servers, dict):
    servers = {}
    cfg["mcpServers"] = servers
vscode = servers.get("vscode")
if not isinstance(vscode, dict):
    vscode = {}
    servers["vscode"] = vscode
cmd = str(vscode.get("command") or "")
if not cmd or cmd.lower().endswith("vscode_mcp.exe") or "\\" in cmd:
    vscode["command"] = py_cmd
    vscode["args"] = [mcp_py]
    vscode.setdefault("env", {})
cfg_path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
' "$PY"
    log "Configured config.json for vscode_mcp.py."
fi

# --- 3. Replace any previous bridge holding the port ------------------------
echo "  [3/3] Starting bridge..."
# lsof ships with macOS and most Linux distros. A previous bridge left running
# (e.g. this launcher double-clicked twice) would keep the port bound and the
# new instance would fail to bind - free it first.
if command -v lsof >/dev/null 2>&1; then
    OLD_PID="$(lsof -ti "tcp:$BRIDGE_PORT" -s TCP:LISTEN 2>/dev/null | head -n1)"
    if [ -n "${OLD_PID:-}" ]; then
        echo "        A previous bridge (pid $OLD_PID) is on port $BRIDGE_PORT. Replacing it..."
        log "Killing previous bridge pid $OLD_PID on port $BRIDGE_PORT."
        kill -TERM "$OLD_PID" 2>/dev/null || true
        sleep 1
        # If it ignored TERM, force it so the rebind below cannot fail.
        if kill -0 "$OLD_PID" 2>/dev/null; then
            kill -9 "$OLD_PID" 2>/dev/null || true
            sleep 1
        fi
    fi
fi

echo
echo "  ############################################################"
echo "  ##   KEEP THIS WINDOW OPEN - DO NOT CLOSE IT              ##"
echo "  ##   Snapgent stops working if you close it. Just       ##"
echo "  ##   minimize this window and leave it running.           ##"
echo "  ############################################################"
echo
log "Launching bridge.py with $PY"

if [ -n "$BRIDGE_BIN" ]; then
    "$BRIDGE_BIN"
else
    "$PY" bridge.py
fi
BRIDGE_EXIT=$?
log "bridge exited with code $BRIDGE_EXIT"

echo
if [ "$BRIDGE_EXIT" -ne 0 ]; then
    echo "  Bridge stopped with ERROR code $BRIDGE_EXIT - scroll up for the Python"
    echo "  error and include this whole window in any bug report (logs/start.log)."
else
    echo "  Bridge stopped normally."
fi
pause_and_exit "$BRIDGE_EXIT"
