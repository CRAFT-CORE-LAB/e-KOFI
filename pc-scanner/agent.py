#!/usr/bin/env python3
"""Local Live20R/SLK20R reader for e-KOFI. The phone app finds this on Wi-Fi."""

from __future__ import annotations

import base64
import json
import os
import socket
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

PORT = 8787
UDP_PORT = 8788

_zk = None
_lock = threading.RLock()
_last_error = "Reader not opened yet."
_device_count = 0


def lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        probe.close()
        if ip not in ips:
            ips.insert(0, ip)
    except OSError:
        pass
    return ips


def _json_bytes(payload: dict[str, Any], status: int = 200) -> tuple[int, bytes]:
    body = json.dumps(payload).encode("utf-8")
    return status, body


def _b64(data: Any) -> str:
    if data is None:
        return ""
    if isinstance(data, str):
        return data
    if isinstance(data, memoryview):
        data = data.tobytes()
    return base64.b64encode(bytes(data)).decode("ascii")


def _from_b64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def _already_inited(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "capture library" in text or "already connected" in text or "already" in text


def _device_is_open(zk: Any) -> bool:
    if zk is None:
        return False
    handle = getattr(zk, "devHandle", None)
    if handle is None:
        return False
    try:
        return int(handle) not in (0, -1)
    except Exception:
        return True


def _windows_reader_present() -> bool | None:
    """True when Windows currently has the Live20R plugged in. None if the check itself failed."""
    if os.name != "nt":
        return None
    try:
        import subprocess

        completed = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | "
                "Where-Object { $_.InstanceId -like 'USB\\VID_1B55&PID_012*' }).Count",
            ],
            capture_output=True,
            text=True,
            timeout=12,
        )
    except Exception:
        return None
    text = completed.stdout.strip()
    if not text.isdigit():
        return None
    return int(text) > 0


def _release_reader() -> None:
    global _zk, _device_count
    if _zk is not None:
        try:
            _zk.CloseDevice()
        except Exception:
            pass
        try:
            _zk.Terminate()
        except Exception:
            pass
    _zk = None
    _device_count = 0


def open_reader() -> dict[str, Any]:
    global _zk, _last_error, _device_count
    with _lock:
        try:
            from pyzkfp import ZKFP2
        except Exception as exc:
            _last_error = (
                "Fingerprint software is missing on this PC. Install ZKFinger SDK for Windows, then run this reader again."
            )
            _device_count = 0
            return {"ok": False, "error": _last_error, "detail": str(exc)}

        present = _windows_reader_present()
        if present is False:
            _release_reader()
            _last_error = (
                "The Live20R is not plugged into this computer. "
                "Plug it in here, or plug it into the phone with a USB OTG adapter."
            )
            return {"ok": False, "error": _last_error, "devices": 0}

        try:
            if _device_is_open(_zk):
                _device_count = int(_zk.GetDeviceCount() or _device_count or 1)
                _last_error = ""
                return {"ok": True, "devices": _device_count, "reused": True}

            if _zk is None:
                _zk = ZKFP2()
                try:
                    _zk.Init()
                except Exception as exc:
                    if not _already_inited(exc):
                        raise

            _device_count = int(_zk.GetDeviceCount() or 0)
            if _device_count < 1:
                _last_error = (
                    "Windows can see the Live20R USB plug, but no fingerprint driver is installed. "
                    "Install ZKFinger SDK for Windows, then unplug and plug the reader back in."
                )
                return {"ok": False, "error": _last_error, "devices": 0}

            try:
                _zk.OpenDevice(0)
            except Exception as exc:
                if not _already_inited(exc) and not _device_is_open(_zk):
                    raise

            _last_error = ""
            return {"ok": True, "devices": _device_count}
        except Exception as exc:
            text = str(exc)
            if _already_inited(exc) or "algorithm library" in text.lower() or "no device" in text.lower():
                _last_error = (
                    "Plug the Live20R into a USB port on this computer, wait for Windows to recognize it, then tap Connect reader again."
                )
            else:
                _last_error = f"Could not open the fingerprint reader: {exc}"
            traceback.print_exc()
            _zk = None
            return {"ok": False, "error": _last_error, "devices": _device_count}


def _capture_one(timeout_s: float = 20.0) -> tuple[Any, Any]:
    if _zk is None:
        raise RuntimeError("Reader is not connected.")
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        capture = _zk.AcquireFingerprint()
        if capture:
            return capture
        time.sleep(0.12)
    raise TimeoutError("No fingerprint was captured. Keep the finger still on the glass.")


def enroll() -> dict[str, Any]:
    with _lock:
        if _zk is None:
            opened = open_reader()
            if not opened.get("ok"):
                return opened
        samples = []
        image = None
        for index in range(3):
            tmp, img = _capture_one()
            samples.append(tmp)
            image = img
        merged = _zk.DBMerge(*samples)
        template = merged[0] if isinstance(merged, tuple) else merged
        return {"ok": True, "template": _b64(template), "image": _b64(image), "captures": 3}


def identify(templates: dict[str, str]) -> dict[str, Any]:
    with _lock:
        if _zk is None:
            opened = open_reader()
            if not opened.get("ok"):
                return opened
        if not templates:
            return {"ok": False, "error": "No fingerprints are registered yet. Register a student first."}
        try:
            _zk.DBClear()
        except Exception:
            pass
        ids: list[str] = []
        for index, (user_id, template) in enumerate(templates.items(), start=1):
            blob = _from_b64(template)
            try:
                _zk.DBAdd(index, blob)
            except Exception:
                try:
                    _zk.DBDel(index)
                except Exception:
                    pass
                try:
                    _zk.DBAdd(index, blob)
                except Exception:
                    continue
            ids.append(user_id)
        if not ids:
            return {"ok": False, "error": "Saved fingerprints could not be loaded. Register the finger again."}
        tmp, img = _capture_one()
        result = _zk.DBIdentify(tmp)
        if isinstance(result, tuple):
            finger_id, score = result[0], result[1] if len(result) > 1 else 0
        else:
            finger_id, score = result, 0
        if not finger_id or finger_id < 1 or finger_id > len(ids):
            return {
                "ok": False,
                "error": "No matching student. Register this fingerprint in the admin screen first.",
                "image": _b64(img),
            }
        return {"ok": True, "userId": ids[finger_id - 1], "score": score, "image": _b64(img)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        print(f"[scanner] {self.address_string()} {format % args}")

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path in ("/", "/health"):
            self._send(
                200,
                {
                    "ok": True,
                    "service": "ekofi-scanner",
                    "devices": _device_count,
                    "error": _last_error,
                    "ips": lan_ips(),
                },
            )
            return
        self._send(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            body = {}
        try:
            if self.path == "/connect":
                self._send(200, open_reader())
                return
            if self.path == "/enroll":
                result = enroll()
                self._send(200 if result.get("ok") else 400, result)
                return
            if self.path == "/identify":
                templates = body.get("templates") or {}
                result = identify(templates)
                self._send(200 if result.get("ok") else 400, result)
                return
            self._send(404, {"ok": False, "error": "Not found"})
        except TimeoutError as exc:
            self._send(408, {"ok": False, "error": str(exc)})
        except Exception as exc:
            traceback.print_exc()
            self._send(500, {"ok": False, "error": str(exc)})


def beacon() -> None:
    message_base = "EKOFI-SCANNER"
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    while True:
        ips = lan_ips() or ["127.0.0.1"]
        for ip in ips:
            payload = f"{message_base} http://{ip}:{PORT}".encode("utf-8")
            try:
                sock.sendto(payload, ("255.255.255.255", UDP_PORT))
                sock.sendto(payload, ("192.168.1.255", UDP_PORT))
                sock.sendto(payload, ("192.168.0.255", UDP_PORT))
            except OSError:
                pass
        time.sleep(2)


def main() -> None:
    ips = ", ".join(lan_ips()) or "this PC"
    print(f"e-KOFI fingerprint reader on http://0.0.0.0:{PORT}", flush=True)
    print(f"Phone and this PC must be on the same Wi-Fi. This computer is {ips}", flush=True)
    threading.Thread(target=beacon, daemon=True).start()
    threading.Thread(target=open_reader, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if _zk is not None:
            try:
                _zk.Terminate()
            except Exception:
                pass


if __name__ == "__main__":
    main()
