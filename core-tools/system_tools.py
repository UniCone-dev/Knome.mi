"""
system_tools.py -- "System control" tools for Knome: let the AI open apps, play media, change a few
settings, install / remove apps and read system information on THIS computer.

SAFETY MODEL (read this before changing anything)
  * Off by default. The tools only exist when KNOME_SYSTEM_TOOLS=1 (set it with ./Knome-start.sh --settings).
  * There is ONE tool, `system` (one tool = few tokens, less confusion for small models). The Knome web UI
    asks the user for permission before EVERY call of it, shows the exact arguments, offers "Allow once" /
    "Deny" only, and can never remember the answer ("Always allow" does not exist for this tool).
  * Nothing here uses sudo. Anything that needs root goes through `pkexec`, which opens the operating
    system's own password dialog, so the OS asks too.
  * Apps are started without a shell and detached. `system_run_command` is the only tool that runs a shell,
    and its small blocklist is just a seatbelt: the real protection is the user reading the command in the
    permission card.
"""

import difflib
import glob
import os
import re
import shlex
import shutil
import subprocess

ENABLED = os.environ.get("KNOME_SYSTEM_TOOLS", "0") == "1"
HOME = os.path.expanduser("~")
MAX_OUT = 6000

APP_DIRS = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    os.path.join(HOME, ".local/share/applications"),
    "/var/lib/flatpak/exports/share/applications",
    os.path.join(HOME, ".local/share/flatpak/exports/share/applications"),
    "/var/lib/snapd/desktop/applications",
]

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9+._\-]{0,100}$")
FLATPAK_ID_RE = re.compile(r"^[A-Za-z0-9_\-]+(\.[A-Za-z0-9_\-]+){2,}$")

# Packages that would break the computer if removed. Only a seatbelt.
PROTECTED_PACKAGES = re.compile(
    r"^(libc6|libc-bin|systemd.*|udev|apt.*|dpkg|bash|dash|coreutils|sudo|polkit.*|pkexec|policykit.*|"
    r"network-manager.*|linux-image.*|linux-base|grub.*|initramfs-tools.*|xorg.*|xserver.*|wayland.*|"
    r"sddm.*|gdm.*|lightdm.*|plasma-desktop.*|plasma-workspace.*|kde-plasma.*|kwin.*|gnome-shell.*|"
    r"dbus.*|libdbus.*|util-linux|mount|login|passwd|python3|python3-minimal|perl-base)$"
)

# Commands refused by system_run_command. Only a seatbelt: the user still reads every command.
BLOCKED_COMMANDS = [
    (r"\brm\s+(-[a-zA-Z]*\s+)*(-[a-zA-Z]*[rf][a-zA-Z]*\s+)+(/|/\*|~|~/|\$HOME|\$HOME/|\.\.?)(\s|$)", "recursive delete of / or your home folder"),
    (r"\bmkfs(\.\w+)?\b", "formatting a disk"),
    (r"\bdd\b[^\n]*\bof=/dev/", "writing straight to a disk"),
    (r">\s*/dev/(sd|nvme|vd|hd)", "writing straight to a disk"),
    (r":\(\)\s*\{", "fork bomb"),
    (r"\bchmod\s+-R\s+\S+\s+/(\s|$)", "changing permissions of the whole system"),
    (r"\b(shutdown|poweroff|reboot|halt)\b", "power off / reboot (do it yourself)"),
    (r"\bsudo\b", "sudo (use install/remove tools: they ask the OS for permission)"),
    (r"\bcrontab\s+-r\b", "deleting all scheduled jobs"),
]


def _clip(text: str, limit: int = MAX_OUT) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + f"\n... (cut, {len(text)} characters in total)"


def _run(cmd, timeout: int = 20, shell: bool = False) -> str:
    """Run a command (list, no shell) and return its text output; never raises."""
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=shell,
            cwd=HOME,
            stdin=subprocess.DEVNULL,
            env=_safe_env(),
        )
        out = (res.stdout or "").strip()
        err = (res.stderr or "").strip()
        text = out if out else err
        if res.returncode != 0:
            text = f"(exit code {res.returncode}) " + (err or out)
        return _clip(text) or "(no output)"
    except FileNotFoundError:
        return f"Error: '{cmd[0] if isinstance(cmd, list) else cmd}' is not installed."
    except subprocess.TimeoutExpired:
        return f"Error: timed out after {timeout}s."
    except Exception as e:  # noqa: BLE001
        return f"Error: {e}"


def _safe_env() -> dict:
    """Environment without anything that looks like a secret."""
    bad = re.compile(r"(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)", re.I)
    return {k: v for k, v in os.environ.items() if not bad.search(k)}


def _spawn(cmd: list) -> str:
    """Start a GUI program detached from Knome (no shell)."""
    try:
        subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            cwd=HOME,
            env=_safe_env(),
        )
        return "started"
    except FileNotFoundError:
        return f"Error: '{cmd[0]}' is not installed."
    except Exception as e:  # noqa: BLE001
        return f"Error: {e}"


def _desktop_entries() -> list:
    entries, seen = [], set()
    for d in APP_DIRS:
        for path in sorted(glob.glob(os.path.join(d, "*.desktop"))):
            app_id = os.path.basename(path)[:-8]
            if app_id in seen:
                continue
            try:
                name = exec_line = comment = ""
                hidden = False
                typ = "Application"
                in_main = False
                with open(path, encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("["):
                            in_main = line == "[Desktop Entry]"
                            continue
                        if not in_main or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        if k == "Name" and not name:
                            name = v
                        elif k == "Exec" and not exec_line:
                            exec_line = v
                        elif k == "Comment" and not comment:
                            comment = v
                        elif k in ("NoDisplay", "Hidden") and v.lower() == "true":
                            hidden = True
                        elif k == "Type":
                            typ = v
                if name and exec_line and not hidden and typ == "Application":
                    seen.add(app_id)
                    entries.append({"id": app_id, "name": name, "exec": exec_line, "comment": comment, "path": path})
            except OSError:
                continue
    return entries


def _exec_to_argv(exec_line: str) -> list:
    argv = shlex.split(re.sub(r"%[fFuUdDnNickvm]", "", exec_line).replace("%%", "%"))
    return [a for a in argv if a]


def _desktop_name() -> str:
    return (os.environ.get("XDG_CURRENT_DESKTOP", "") or "").lower()



MEDIA_EXT = (".mp3", ".mp4", ".mkv", ".flac", ".wav", ".ogg", ".opus", ".m4a", ".webm", ".avi", ".mov", ".aac", ".wma", ".m4v")
FLATHUB_URL = "https://dl.flathub.org/repo/flathub.flatpakrepo"
HELPERS = ["vlc", "mpv", "playerctl", "wpctl", "pactl", "brightnessctl", "nmcli", "rfkill", "flatpak", "pkexec", "gio", "xdg-open"]


# ---------------------------------------------------------------- helpers

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _xdg_dir(kind: str, fallback: str) -> str:
    out = ""
    if shutil.which("xdg-user-dir"):
        out = _run(["xdg-user-dir", kind]).strip()
    if out and not out.startswith(("Error", "(exit")) and os.path.isdir(out) and out != HOME:
        return out
    return os.path.join(HOME, fallback)


def _roots(kinds) -> list:
    table = {
        "music": ("MUSIC", "Music"), "videos": ("VIDEOS", "Videos"), "downloads": ("DOWNLOAD", "Downloads"),
        "documents": ("DOCUMENTS", "Documents"), "desktop": ("DESKTOP", "Desktop"), "pictures": ("PICTURES", "Pictures"),
    }
    out = []
    for k in kinds:
        d = _xdg_dir(*table[k])
        for cand in (d, os.path.join(HOME, table[k][1])):
            if os.path.isdir(cand) and cand not in out:
                out.append(cand)
    return out


def _find_files(query: str, roots: list, exts=None, limit: int = 15) -> list:
    """Case-insensitive, punctuation-blind search (depth <= 6). Falls back to close spellings."""
    q = _norm(query)
    words = [_norm(w) for w in re.split(r"\s+", query.strip()) if _norm(w)]
    if not q:
        return []
    hits, names, scanned = [], [], 0
    for root in roots:
        for dp, dn, files in os.walk(root):
            dn[:] = [d for d in dn if not d.startswith(".")]
            if dp[len(root):].count(os.sep) >= 6:
                dn[:] = []
            for fn in files:
                scanned += 1
                if scanned > 40000:
                    break
                if fn.startswith(".") or (exts and not fn.lower().endswith(exts)):
                    continue
                stem = _norm(os.path.splitext(fn)[0])
                full = os.path.join(dp, fn)
                names.append((stem, full))
                if q in stem or all(w in stem for w in words):
                    hits.append((0 if stem == q else 1, len(fn), full))
            if scanned > 40000:
                break
    if not hits:
        close = difflib.get_close_matches(q, [n for n, _ in names], n=5, cutoff=0.6)
        hits = [(2, len(f), f) for n, f in names if n in close]
    hits.sort()
    return [h[2] for h in hits[:limit]]


def _have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def _helpers_line() -> str:
    ok = [h for h in HELPERS if _have(h)]
    missing = [h for h in HELPERS if not _have(h)]
    return "Tools present: " + (", ".join(ok) or "none") + ("\nTools missing: " + ", ".join(missing) if missing else "")


def _apt_candidates(q: str, n: int = 10) -> str:
    out = _run(["apt-cache", "search", "--names-only", q], timeout=30)
    if out.startswith(("Error", "(exit", "(no output")) or not out:
        return ""
    return "\n".join(out.splitlines()[:n])


# ---------------------------------------------------------------- actions

def _info() -> str:
    lines = []
    try:
        with open("/etc/os-release", encoding="utf-8") as f:
            for line in f:
                if line.startswith("PRETTY_NAME="):
                    lines.append("OS: " + line.split("=", 1)[1].strip().strip('"'))
    except OSError:
        pass
    lines.append("Kernel: " + _run(["uname", "-sr"]))
    lines.append("Desktop: " + (os.environ.get("XDG_CURRENT_DESKTOP") or "unknown") + " / " + (os.environ.get("XDG_SESSION_TYPE") or "?"))
    try:
        with open("/proc/cpuinfo", encoding="utf-8") as f:
            txt = f.read()
        m = re.search(r"model name\s*:\s*(.+)", txt)
        threads = len(re.findall(r"^processor\s*:", txt, re.M))
        lines.append(f"CPU: {m.group(1).strip() if m else 'unknown'} ({threads} threads)")
    except OSError:
        pass
    try:
        with open("/proc/meminfo", encoding="utf-8") as f:
            mem = {l.split(":")[0]: int(l.split()[1]) for l in f if ":" in l}
        lines.append(f"RAM: {mem['MemTotal'] / 1048576:.1f} GB total, {mem.get('MemAvailable', 0) / 1048576:.1f} GB free")
    except (OSError, KeyError, ValueError):
        pass
    gpu = _run("lspci 2>/dev/null | grep -Ei 'vga|3d|display'", shell=True)
    if gpu and not gpu.startswith(("(", "Error")):
        lines.append("GPU:\n  " + gpu.replace("\n", "\n  "))
    try:
        du = shutil.disk_usage(HOME)
        lines.append(f"Disk (home): {du.free / 1e9:.0f} GB free of {du.total / 1e9:.0f} GB")
    except OSError:
        pass
    for bat in sorted(glob.glob("/sys/class/power_supply/BAT*")):
        try:
            cap = open(os.path.join(bat, "capacity")).read().strip()
            st = open(os.path.join(bat, "status")).read().strip()
            lines.append(f"Battery: {cap}% ({st})")
        except OSError:
            pass
    try:
        with open("/proc/uptime", encoding="utf-8") as f:
            up = float(f.read().split()[0])
        lines.append(f"Uptime: {int(up // 3600)} h {int(up % 3600 // 60)} min")
    except (OSError, ValueError):
        pass
    lines.append(_helpers_line())
    return "\n".join(lines)


def _apps(query: str) -> str:
    q = _norm(query)
    apps = [a for a in _desktop_entries() if not q or q in _norm(a["name"]) or q in _norm(a["id"])]
    if not apps:
        return "No matching app. Try action=find_app to search for one to install."
    return "\n".join(f"{a['name']}  [{a['id']}]" for a in apps[:40]) + (
        f"\n... and {len(apps) - 40} more, narrow the filter" if len(apps) > 40 else ""
    )


def _open_app(name: str) -> str:
    raw = name.strip()
    n = _norm(raw)
    if not n:
        return "Error: target = the app name."
    apps = _desktop_entries()
    exact = [a for a in apps if n in (_norm(a["name"]), _norm(a["id"]), _norm(a["id"].split(".")[-1]))]
    starts = [a for a in apps if _norm(a["name"]).startswith(n) or _norm(a["id"]).startswith(n)]
    contains = [a for a in apps if n in _norm(a["name"]) or n in _norm(a["id"]) or n in _norm(a["comment"])]
    app = None
    for group in (exact, starts, contains):
        if len(group) == 1:
            app = group[0]
            break
        if len(group) > 1:
            return "More than one app matches, repeat with the exact id:\n" + "\n".join(
                f"{a['name']}  [{a['id']}]" for a in group[:10]
            )
    if app is None:
        if NAME_RE.match(raw) and shutil.which(raw):
            res = _spawn([raw])
            return f"Opened {raw}." if res == "started" else res
        close = difflib.get_close_matches(n, [_norm(a["name"]) for a in apps], n=3, cutoff=0.6)
        sugg = [a["name"] for a in apps if _norm(a["name"]) in close]
        return (f"'{raw}' is not installed." + (f" Similar: {', '.join(sugg)}." if sugg else "")
                + " Next: action=find_app target=" + raw + " to look for it, then action=install.")
    if _have("gio"):
        res = _spawn(["gio", "launch", app["path"]])
    else:
        res = _spawn(_exec_to_argv(app["exec"]))
    return f"Opened {app['name']}." if res == "started" else res


def _open(target: str) -> str:
    t = target.strip()
    if not t or t.startswith("-"):
        return "Error: target = web address, file or folder."
    if re.match(r"^https?://", t, re.I):
        res = _spawn(["xdg-open", t])
    else:
        p = os.path.abspath(os.path.expanduser(t))
        if not os.path.exists(p):
            found = _find_files(t, _roots(["documents", "downloads", "desktop", "pictures", "music", "videos"]), limit=5)
            if len(found) == 1:
                p = found[0]
            else:
                return f"'{t}' does not exist." + (("\nSimilar:\n" + "\n".join(found)) if found else " Try action=files target=<name>.")
        res = _spawn(["xdg-open", p])
    return "Opened." if res == "started" else res


def _files(query: str) -> str:
    if not query.strip():
        return "Error: target = part of the file name."
    found = _find_files(query, _roots(["documents", "downloads", "desktop", "pictures", "music", "videos"]), limit=20)
    return "\n".join(found) if found else f"No file like '{query}' in Documents, Downloads, Desktop, Pictures, Music, Videos."


def _play(target: str) -> str:
    t = target.strip()
    if not t:
        return _media("play")
    if t.startswith("-"):
        return "Error: invalid target."
    if not re.match(r"^https?://", t, re.I):
        p = os.path.abspath(os.path.expanduser(t))
        if not os.path.exists(p):
            found = _find_files(t, _roots(["music", "videos", "downloads", "desktop"]), exts=MEDIA_EXT)
            if not found:
                found = _find_files(t, _roots(["documents", "pictures"]), exts=MEDIA_EXT)
            if not found:
                return (f"No audio/video file like '{t}' in Music, Videos, Downloads, Desktop. "
                        "Ask the user for the exact name or folder, or try action=files.")
            stems = [os.path.splitext(os.path.basename(f))[0] for f in found]
            best = [f for f, s in zip(found, stems) if _norm(s) == _norm(t)]
            if len(found) == 1 or len(best) == 1:
                p = (best or found)[0]
            else:
                return "Several files match. Repeat with the exact path:\n" + "\n".join(found[:10])
        t = p
    player = next((c for c in ("vlc", "mpv") if _have(c)), None)
    res = _spawn([player, t]) if player else _spawn(["xdg-open", t])
    return f"Playing {t}" if res == "started" else res


def _media(cmd: str) -> str:
    keys = {
        "play": ["play"], "pause": ["pause"], "toggle": ["play-pause"], "next": ["next"],
        "previous": ["previous"], "stop": ["stop"], "volume_up": ["volume", "0.05+"], "volume_down": ["volume", "0.05-"],
    }
    c = cmd.strip().lower()
    if c not in keys:
        return "Error: media target = pause, toggle, play, next, previous, stop, volume_up, volume_down."
    if not _have("playerctl"):
        return ("Error: 'playerctl' is not installed (needed to control a running player). "
                "Next: action=install target=playerctl source=apt")
    return _run(["playerctl", *keys[c]]) or "ok"


def _gdbus_int(dest: str, path: str, method: str, *args: str):
    out = _run(["gdbus", "call", "--session", "--dest", dest, "--object-path", path, "--method", method, *args], timeout=8)
    m = re.search(r"-?\d+", out) if not out.startswith(("Error", "(exit")) else None
    return int(m.group(0)) if m else None


def _brightness(v: str) -> str:
    v = v.strip().lower()
    if v in ("up", "down"):
        v = "+10" if v == "up" else "-10"
    if v != "get" and not re.fullmatch(r"[+-]?\d{1,3}", v):
        return "Error: brightness value = 1-100, +10, -10, up, down or get."
    if _have("brightnessctl"):
        if v == "get":
            return _run(["brightnessctl", "-m"])
        if v[0] in "+-":
            return _run(["brightnessctl", "set", f"{v[1:]}%{v[0]}"]) or "ok"
        return _run(["brightnessctl", "set", f"{max(1, min(100, int(v)))}%"])
    if _have("gdbus"):
        # KDE Plasma 6, then older Plasma
        for dest, path, getmax, getcur, setter in (
            ("org.kde.ScreenBrightness", "/org/kde/ScreenBrightness/display0", "MaxBrightness", "Brightness", "set6"),
            ("org.kde.Solid.PowerManagement", "/org/kde/Solid/PowerManagement/Actions/BrightnessControl", "brightnessMax", "brightness", "set5"),
        ):
            if setter == "set6":
                mx = _gdbus_int(dest, path, "org.freedesktop.DBus.Properties.Get", "org.kde.ScreenBrightness.Display", getmax)
                cur = _gdbus_int(dest, path, "org.freedesktop.DBus.Properties.Get", "org.kde.ScreenBrightness.Display", getcur)
            else:
                mx = _gdbus_int(dest, path, "org.kde.Solid.PowerManagement.Actions.BrightnessControl." + getmax)
                cur = _gdbus_int(dest, path, "org.kde.Solid.PowerManagement.Actions.BrightnessControl." + getcur)
            if not mx:
                continue
            if v == "get":
                return f"brightness {round(100 * (cur or 0) / mx)}%"
            pct = (round(100 * (cur or 0) / mx) + int(v)) if v[0] in "+-" else int(v)
            target = max(1, round(max(1, min(100, pct)) * mx / 100))
            if setter == "set6":
                _run(["gdbus", "call", "--session", "--dest", dest, "--object-path", path,
                      "--method", "org.kde.ScreenBrightness.Display.SetBrightness", str(target), "0"], timeout=8)
            else:
                _run(["gdbus", "call", "--session", "--dest", dest, "--object-path", path,
                      "--method", "org.kde.Solid.PowerManagement.Actions.BrightnessControl.setBrightness", str(target)], timeout=8)
            return f"brightness set to about {max(1, min(100, pct))}% (via KDE)"
    return ("Error: no way to change brightness (brightnessctl missing and KDE power service not reachable). "
            "Next: action=install target=brightnessctl source=apt")


def _volume(v: str) -> str:
    use_wp = _have("wpctl")
    if not use_wp and not _have("pactl"):
        return "Error: neither wpctl nor pactl found (no sound server tools)."
    if v == "get":
        return _run(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"]) if use_wp else _run(["pactl", "get-sink-volume", "@DEFAULT_SINK@"])
    if v in ("up", "down"):
        v = "+10" if v == "up" else "-10"
    if re.fullmatch(r"[+-]\d{1,2}", v):
        n = int(v[1:])
        if use_wp:
            return _run(["wpctl", "set-volume", "-l", "1.0", "@DEFAULT_AUDIO_SINK@", f"{n}%{v[0]}"]) or "ok"
        return _run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{v[0]}{n}%"]) or "ok"
    if v.isdigit() and 0 <= int(v) <= 100:
        if use_wp:
            return _run(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{int(v)}%"]) or "ok"
        return _run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{int(v)}%"]) or "ok"
    return "Error: volume value = 0-100, +10, -10, up, down or get."


def _set(name: str, value: str) -> str:
    n, v = name.strip().lower(), value.strip().lower()
    if n in ("volume", "sound", "audio"):
        return _volume(v)
    if n == "mute":
        if v not in ("on", "off", "toggle"):
            return "Error: mute value = on, off or toggle."
        arg = {"on": "1", "off": "0", "toggle": "toggle"}[v]
        if _have("wpctl"):
            return _run(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", arg]) or "ok"
        return _run(["pactl", "set-sink-mute", "@DEFAULT_SINK@", arg]) or "ok"
    if n in ("brightness", "screen"):
        return _brightness(v)
    if n == "wifi":
        if v not in ("on", "off"):
            return "Error: wifi value = on or off."
        return _run(["nmcli", "radio", "wifi", v]) or "ok"
    if n == "bluetooth":
        if v not in ("on", "off"):
            return "Error: bluetooth value = on or off."
        return _run(["rfkill", "unblock" if v == "on" else "block", "bluetooth"]) or "ok"
    return "Error: set target = volume, mute, brightness, wifi or bluetooth."


def _settings(page: str) -> str:
    p = page.strip().lower()
    de = _desktop_name()
    if "gnome" in de and _have("gnome-control-center"):
        pages = {"network": "wifi", "wifi": "wifi", "sound": "sound", "display": "display", "bluetooth": "bluetooth", "power": "power"}
        cmd = ["gnome-control-center"] + ([pages[p]] if p in pages else [])
    elif _have("systemsettings") or _have("kcmshell6"):
        kcm = {"network": "kcm_networkmanagement", "wifi": "kcm_networkmanagement", "sound": "kcm_pulseaudio",
               "display": "kcm_kscreen", "bluetooth": "kcm_bluetooth", "power": "kcm_powerdevilprofilesconfig"}
        if p in kcm and _have("kcmshell6"):
            cmd = ["kcmshell6", kcm[p]]
        elif _have("systemsettings"):
            cmd = ["systemsettings"]
        else:
            return "Error: no settings app found."
    else:
        return "Error: no settings app found for this desktop."
    res = _spawn(cmd)
    return "Opened system settings." if res == "started" else res


def _flatpak_search(q: str) -> list:
    out = _run(["flatpak", "search", "--columns=application,name", q], timeout=40)
    rows = []
    if out.startswith(("Error", "(exit")):
        return rows
    for line in out.splitlines():
        parts = [x.strip() for x in re.split(r"\t+|\s{2,}", line) if x.strip()]
        if len(parts) >= 2 and FLATPAK_ID_RE.match(parts[0]):
            rows.append((parts[0], parts[1]))
    return rows


def _ensure_flathub() -> str:
    out = _run(["flatpak", "remotes", "--user", "--columns=name"])
    if "flathub" in out.split():
        return ""
    res = _run(["flatpak", "remote-add", "--user", "--if-not-exists", "flathub", FLATHUB_URL], timeout=60)
    return "" if "rror" not in res else "Could not add Flathub: " + res


def _find_app(q: str) -> str:
    q = q.strip()
    if not q or q.startswith("-"):
        return "Error: target = what to look for (e.g. 'screen recorder')."
    parts = []
    if _have("flatpak"):
        rows = _flatpak_search(q)[:8]
        parts.append("Flathub (source=flatpak, use the id):\n" + ("\n".join(f"{i}  ({n})" for i, n in rows) if rows else "nothing"))
    else:
        parts.append("Flatpak is not installed (Next: action=install target=flatpak source=apt, then retry).")
    apt = _apt_candidates(q)
    parts.append("apt (source=apt, use the package name):\n" + (apt or "nothing"))
    return "\n\n".join(parts)


def _install(name: str, source: str) -> str:
    n = name.strip()
    s = source.strip().lower() or "auto"
    if not n or n.startswith("-"):
        return "Error: target = app name or id."
    if s not in ("auto", "flatpak", "apt"):
        return "Error: source = flatpak, apt or leave empty."
    if s == "auto":
        s = "flatpak" if _have("flatpak") else "apt"
    if s == "flatpak":
        if not _have("flatpak"):
            return "Flatpak is not installed. Next: action=install target=flatpak source=apt (asks the OS password), or use source=apt for this app."
        app_id = n
        if not FLATPAK_ID_RE.match(n):
            rows = _flatpak_search(n)
            exact = [r for r in rows if _norm(r[1]) == _norm(n) or _norm(r[0].split(".")[-1]) == _norm(n)]
            if len(exact) == 1:
                app_id = exact[0][0]
            elif len(rows) == 1:
                app_id = rows[0][0]
            elif rows:
                return "Several apps match. Repeat with the exact id:\n" + "\n".join(f"{i}  ({m})" for i, m in rows[:8])
            else:
                alt = _apt_candidates(n)
                return f"Nothing called '{n}' on Flathub." + (f" apt has:\n{alt}\nNext: repeat with source=apt and the package name." if alt else "")
        err = _ensure_flathub()
        if err:
            return err
        res = _run(["flatpak", "install", "--user", "-y", "--noninteractive", "flathub", app_id], timeout=900)
        return res if res.startswith(("Error", "(exit")) else f"Installed {app_id}. {res[-300:]}"
    # apt
    if not NAME_RE.match(n):
        # a description like "screen recorder": show real package names instead of failing
        alt = _apt_candidates(n.split()[0] if n.split() else n)
        hint = "" if _have("flatpak") else "\nFlatpak (Flathub) is not installed: action=install target=flatpak source=apt adds it."
        return ("Give an exact package name. apt has:\n" + alt + hint) if alt else "Error: invalid package name." + hint
    pol = _run(["apt-cache", "policy", n], timeout=20)
    if "Candidate: (none)" in pol or not pol or pol.startswith(("Error", "(exit")):
        alt = _apt_candidates(n)
        return f"No apt package named '{n}'." + (f" Did you mean:\n{alt}" if alt else "")
    return _run(["pkexec", "apt-get", "install", "-y", n], timeout=900)


def _remove(name: str, source: str) -> str:
    n = name.strip()
    s = source.strip().lower() or "auto"
    if not n or n.startswith("-"):
        return "Error: target = app name or id."
    if s in ("auto", "flatpak") and _have("flatpak"):
        app_id = n if FLATPAK_ID_RE.match(n) else ""
        if not app_id:
            out = _run(["flatpak", "list", "--app", "--columns=application,name"])
            for line in out.splitlines():
                parts = [x.strip() for x in re.split(r"\t+|\s{2,}", line) if x.strip()]
                if len(parts) >= 2 and (_norm(parts[1]) == _norm(n) or _norm(parts[0].split(".")[-1]) == _norm(n)):
                    app_id = parts[0]
                    break
        if app_id:
            res = _run(["flatpak", "uninstall", "--user", "-y", "--noninteractive", app_id], timeout=300)
            if "not installed" in res.lower() and s == "auto":
                res = _run(["flatpak", "uninstall", "--system", "-y", "--noninteractive", app_id], timeout=300)
            return res if res.startswith(("Error", "(exit")) else f"Removed {app_id}."
        if s == "flatpak":
            return f"No Flatpak app '{n}' installed. Next: action=apps target={n}"
    if not NAME_RE.match(n):
        return "Error: invalid package name."
    if PROTECTED_PACKAGES.match(n):
        return f"Refused: '{n}' is part of the core system."
    if "install ok installed" not in _run(["dpkg", "-s", n]):
        return f"'{n}' is not an installed apt package or Flatpak app. Next: action=apps target={n}"
    return _run(["pkexec", "apt-get", "remove", "-y", n], timeout=600)


def _run_cmd(command: str, timeout_text: str) -> str:
    c = command.strip()
    if not c:
        return "Error: target = the shell command."
    if len(c) > 2000:
        return "Error: command too long."
    for pattern, why in BLOCKED_COMMANDS:
        if re.search(pattern, c):
            return f"Refused: {why}."
    try:
        t = max(1, min(int(timeout_text or 30), 120))
    except ValueError:
        t = 30
    return _run(["bash", "-c", c], timeout=t)


ACTIONS = ("info", "apps", "open_app", "open", "files", "play", "media", "set", "settings", "find_app", "install", "remove", "run")
ALIASES = {
    "specs": "info", "system_info": "info", "list_apps": "apps", "list": "apps", "launch": "open_app", "app": "open_app",
    "open-app": "open_app", "start": "open_app", "play_file": "play", "music": "play", "setting": "set", "search_files": "files",
    "find": "files", "open_settings": "settings", "search_app": "find_app", "download": "install", "uninstall": "remove",
    "delete_app": "remove", "command": "run", "shell": "run", "exec": "run",
}


def system(action: str, target: str = "", value: str = "", source: str = "") -> str:
    """Run one action on this computer (the user is asked every time). Dispatcher used by the MCP tool."""
    a = re.sub(r"[\s\-]+", "_", (action or "").strip().lower())
    a = ALIASES.get(a, a)
    t, v, s = (target or "").strip(), (value or "").strip(), (source or "").strip()
    try:
        if a == "info":
            return _info()
        if a == "apps":
            return _apps(t)
        if a == "open_app":
            return _open_app(t)
        if a == "open":
            return _open(t)
        if a == "files":
            return _files(t)
        if a == "play":
            return _play(t)
        if a == "media":
            return _media(t or v)
        if a == "set":
            return _set(t, v)
        if a == "settings":
            return _settings(t)
        if a == "find_app":
            return _find_app(t)
        if a == "install":
            return _install(t, s)
        if a == "remove":
            return _remove(t, s)
        if a == "run":
            return _run_cmd(t, v)
    except Exception as e:  # noqa: BLE001
        return f"Error: {e}"
    return "Unknown action '" + (action or "") + "'. Actions: " + ", ".join(ACTIONS)


SYSTEM_DOC = """Control THIS computer. The user is asked to allow every call. Arguments: action, target, value, source.
info                      specs: OS, CPU, RAM, GPU, disk, battery, which helper tools exist
apps [target=filter]      list installed apps
open_app target=NAME      open an installed app (vlc, firefox, ...)
open target=URL|path      open a web page, file or folder
files target=NAME         find a file by (part of) its name
play target=NAME|path|URL play audio/video in VLC (finds it in Music/Videos/Downloads; empty target = resume)
media target=pause|toggle|next|previous|stop|volume_up|volume_down
set target=volume|mute|brightness|wifi|bluetooth value=0-100|+10|-10|on|off|toggle|get
settings [target=network|sound|display|bluetooth|power]
find_app target=WORDS     search Flathub/apt;  install target=NAME|id [source=flatpak|apt];  remove target=NAME|id
run target=SHELL_COMMAND source=WHAT_IT_DOES [value=seconds]   no sudo. Unsure of a command for this distro? web-search first.
    (a command that works is saved to the user's command memory under source)
Error messages say what to do next: do that."""


def register(mcp) -> bool:
    """Add the single `system` tool to the MCP server. Returns False (and adds nothing) when disabled."""
    if not ENABLED:
        return False

    @mcp.tool(name="system", description=SYSTEM_DOC)
    def system_tool(action: str, target: str = "", value: str = "", source: str = "") -> str:
        return system(action, target, value, source)

    return True
