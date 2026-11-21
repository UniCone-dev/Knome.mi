//! Backend handling without any GUI code (so it can be tested on its own):
//! find the settings, start start-knome.sh in its own process group, stop it again.
use std::fs;
use std::io::Read;
use std::net::{SocketAddr, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

/// Port from LLM_PORT, else KNOME_PORT in <data>/.knome-state/settings.env, else 8080.
pub fn port(data_dir: &Path) -> u16 {
    if let Ok(p) = std::env::var("LLM_PORT") {
        if let Ok(n) = p.trim().parse() {
            return n;
        }
    }
    if let Ok(text) = fs::read_to_string(data_dir.join(".knome-state/settings.env")) {
        for line in text.lines() {
            if let Some(v) = line.trim().strip_prefix("KNOME_PORT=") {
                if let Ok(n) = v.trim().trim_matches('"').parse() {
                    return n;
                }
            }
        }
    }
    8080
}

/// Where the data lives: KNOME_DATA_DIR (the AppImage sets it), else the Knome folder that holds start-knome.sh
/// (normal install: settings, memory ... are in that folder), else ~/.local/share/Knome.
pub fn data_dir(script: Option<&Path>) -> PathBuf {
    if let Ok(d) = std::env::var("KNOME_DATA_DIR") {
        return PathBuf::from(d);
    }
    if let Some(dir) = script.and_then(|s| s.parent()) {
        if dir.join(".knome-state").is_dir() {
            return dir.to_path_buf();
        }
    }
    let base = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".local/share"));
    base.join("Knome")
}

/// The script that starts everything: KNOME_START_SCRIPT, else start-knome.sh next to the program / in the current folder.
pub fn start_script() -> Option<PathBuf> {
    if let Ok(s) = std::env::var("KNOME_START_SCRIPT") {
        return Some(PathBuf::from(s));
    }
    let mut cands: Vec<PathBuf> = vec![PathBuf::from("start-knome.sh")];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(d) = exe.parent() {
            cands.push(d.join("start-knome.sh"));
            cands.push(d.join("../start-knome.sh"));
            cands.push(d.join("../../../../start-knome.sh")); // app/src-tauri/target/release -> repo root
            cands.push(d.join("../../../start-knome.sh"));
        }
    }
    cands.into_iter().find(|p| p.is_file()).map(|p| p.canonicalize().unwrap_or(p))
}

/// Start the backend in its own process group (so everything it starts can be stopped together).
pub fn spawn(script: &Path) -> std::io::Result<Child> {
    let mut cmd = Command::new("bash");
    cmd.arg(script)
        .env("KNOME_NO_BROWSER", "1") // the window is this program, no browser
        .stdin(Stdio::null())
        .process_group(0);
    if let Some(dir) = script.parent() {
        if dir.is_dir() {
            cmd.current_dir(dir);
        }
    }
    cmd.spawn()
}

/// Stop the backend and everything it started.
pub fn stop(child: &mut Child) {
    let pid = child.id() as i32;
    unsafe {
        libc::kill(-pid, libc::SIGTERM);
    }
    let t = Instant::now();
    while t.elapsed() < Duration::from_secs(5) {
        if let Ok(Some(_)) = child.try_wait() {
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    unsafe {
        libc::kill(-pid, libc::SIGKILL);
    }
    let _ = child.wait();
}

/// True once http://127.0.0.1:port answers.
pub fn is_up(port: u16) -> bool {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    match TcpStream::connect_timeout(&addr, Duration::from_millis(400)) {
        Ok(mut s) => {
            use std::io::Write;
            let _ = s.set_read_timeout(Some(Duration::from_millis(800)));
            let _ = s.write_all(b"GET / HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
            let mut buf = [0u8; 12];
            s.read(&mut buf).map(|n| n >= 9 && &buf[..5] == b"HTTP/").unwrap_or(false)
        }
        Err(_) => false,
    }
}

pub fn wait_until_up(port: u16, secs: u64, child: &mut Child) -> bool {
    let t = Instant::now();
    while t.elapsed() < Duration::from_secs(secs) {
        if is_up(port) {
            return true;
        }
        if let Ok(Some(_)) = child.try_wait() {
            return false; // the backend exited (e.g. no model found)
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    false
}
