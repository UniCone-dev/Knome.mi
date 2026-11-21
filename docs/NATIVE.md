# Knome's own window

`app/` is a small native shell (Rust + Tauri, using the system webview). It starts Knome, waits until it is ready, and shows it in **its own window** - no browser, no tabs, no address bar. Closing the window stops Knome.

```bash
sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev libssl-dev librsvg2-dev libxdo-dev
bash tools/build-native-app.sh
./app/src-tauri/target/release/knome-app          # from the Knome.mi folder
bash tools/build-appimage.sh                      # the AppImage now opens in this window
```

- Run time needs `libwebkit2gtk-4.1-0` (not bundled).
- Links that leave Knome (a web page from an answer) open in **your own browser** (Firefox, LibreWolf, Brave ...), never inside Knome's window.
- `KNOME_WINDOW=browser` / `app` makes the AppImage use a browser instead.
- Private: the window talks only to `127.0.0.1`. No telemetry, no accounts.
- Not done yet: microphone permission in the window, custom title bar, floating character window.
