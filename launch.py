"""
AlertTrader Launcher & Background Server Manager
Ensures the local server is running and opens AlertTrader in your browser.
"""

import os
import sys
import time
import socket
import signal
import subprocess
import webbrowser
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
PID_FILE = PROJECT_DIR / ".server.pid"
DEFAULT_PORT = 8080


def is_port_in_use(port: int) -> bool:
    """Checks whether a port is currently open and bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def is_alert_trader_running(port: int) -> bool:
    """Checks if AlertTrader HTTP server is actively serving on the port."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.4)
            s.connect(("127.0.0.1", port))
            s.sendall(b"GET /index.html HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n")
            data = s.recv(1024)
            return b"AlertTrader" in data
    except Exception:
        return False


def get_pythonw_executable() -> str:
    """Finds pythonw.exe to launch background processes without opening a terminal."""
    py_dir = Path(sys.executable).parent
    pythonw = py_dir / "pythonw.exe"
    if pythonw.is_file():
        return str(pythonw)
    return sys.executable


def start_server(port: int) -> int:
    """Starts the static HTTP server in the background and returns its PID."""
    python_bin = get_pythonw_executable()
    cmd = [
        python_bin,
        "-m",
        "http.server",
        "-b",
        "127.0.0.1",
        "-d",
        str(PROJECT_DIR),
        str(port),
    ]

    creationflags = 0
    if sys.platform == "win32":
        DETACHED_PROCESS = 0x00000008
        CREATE_NEW_PROCESS_GROUP = 0x00000200
        CREATE_NO_WINDOW = 0x08000000
        creationflags = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW

    proc = subprocess.Popen(
        cmd,
        cwd=str(PROJECT_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
        close_fds=True,
    )
    PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    return proc.pid


def stop_server():
    """Stops the running AlertTrader background server."""
    stopped = False
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text(encoding="utf-8").strip())
            os.kill(pid, signal.SIGTERM)
            stopped = True
            print(f"Stopped AlertTrader server (PID: {pid}).")
        except Exception as e:
            print(f"Could not stop server by PID: {e}")
        finally:
            PID_FILE.unlink(missing_ok=True)

    if not stopped:
        print("No active server found or already stopped.")


def launch():
    """Launches the server if not running, then opens the browser."""
    # 1. Check if AlertTrader is already running on port 8080 or nearby ports
    for p in range(DEFAULT_PORT, DEFAULT_PORT + 10):
        if is_alert_trader_running(p):
            webbrowser.open(f"http://localhost:{p}")
            return

    # 2. Find an available port
    target_port = DEFAULT_PORT
    for p in range(DEFAULT_PORT, DEFAULT_PORT + 20):
        if not is_port_in_use(p):
            target_port = p
            break

    # 3. Start the background server
    start_server(target_port)

    # 4. Wait until the server is ready (up to 3 seconds)
    start_time = time.time()
    while time.time() - start_time < 3.0:
        if is_alert_trader_running(target_port):
            break
        time.sleep(0.1)

    # 5. Open browser
    webbrowser.open(f"http://localhost:{target_port}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--stop", "stop"):
        stop_server()
    else:
        launch()
