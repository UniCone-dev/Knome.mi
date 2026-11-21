// Knome native window. The program starts the Knome backend, waits for it, then shows it in its own
// window (the system webview: WebKitGTK). No browser, no tabs, no address bar. Closing the window stops Knome.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod backend;

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};

struct Backend(Mutex<Option<Child>>);

fn open_outside(url: &Url) {
    // links that leave Knome open in the user's own browser (Firefox, LibreWolf, Brave ...), never inside this window
    let _ = Command::new("xdg-open").arg(url.as_str()).spawn();
}

fn main() {
    let script = backend::start_script();
    let data = backend::data_dir(script.as_deref());
    let port = backend::port(&data);
    let home: Url = format!("http://127.0.0.1:{port}/").parse().unwrap();

    tauri::Builder::default()
        .manage(Backend(Mutex::new(None)))
        .setup(move |app| {
            let nav_home = home.clone();
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Knome")
                .inner_size(1280.0, 860.0)
                .min_inner_size(760.0, 520.0)
                .on_navigation(move |u| {
                    let ours = u.scheme() == "tauri"
                        || u.host_str() == Some("tauri.localhost")
                        || (u.host_str() == Some("127.0.0.1") && u.port() == nav_home.port())
                        || u.scheme() == "about"
                        || u.scheme() == "blob"
                        || u.scheme() == "data";
                    if !ours {
                        open_outside(u);
                    }
                    ours
                })
                .build()?;

            let handle = app.handle().clone();
            let script = script.clone();
            std::thread::spawn(move || {
                let state = handle.state::<Backend>();
                // already running (e.g. started by hand)? just connect.
                if !backend::is_up(port) {
                    match script.as_ref().map(|s| backend::spawn(s)) {
                        Some(Ok(child)) => *state.0.lock().unwrap() = Some(child),
                        _ => {
                            let _ = win.eval("document.getElementById('msg').textContent='Could not find start-knome.sh. Start Knome from its folder or the AppImage.'");
                            return;
                        }
                    }
                    let up = {
                        let mut g = state.0.lock().unwrap();
                        match g.as_mut() {
                            Some(c) => backend::wait_until_up(port, 180, c),
                            None => false,
                        }
                    };
                    if !up {
                        let _ = win.eval("document.getElementById('msg').textContent='Knome did not start. Run it in a terminal to see why (usually: no model found - ./Knome-start.sh --models-folder).'");
                        return;
                    }
                }
                let _ = win.navigate(home);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if let Some(state) = window.app_handle().try_state::<Backend>() {
                    if let Some(mut c) = state.0.lock().unwrap().take() {
                        backend::stop(&mut c);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Knome");
}
