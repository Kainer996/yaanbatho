# Download Monitor

A native Linux dashboard for local download activity. Refreshes every two seconds and shows known progress, observed transfer speeds and uncertain states honestly.

## Requirements

Built and tested on Omarchy Linux. Requires system Python 3.10+, PyGObject (the gi module), GTK 4 and libadwaita 1, plus a graphical Linux desktop. On Arch/Omarchy these are provided by python, python-gobject, gtk4 and libadwaita. No Windows or macOS build is provided.

## Install and open

Extract the ZIP, open a terminal in the download-monitor-source folder, then run:

```sh
bash install.sh
bash "$HOME/.local/share/download-monitor/launch.sh"
```

Run as your ordinary desktop user, without sudo. The installer checks the GTK dependencies, copies the app to ~/.local/share/download-monitor and adds an application-menu entry. No top-bar or window-manager configuration is changed. You can also run `bash download-monitor/launch.sh` directly from the extracted folder.

## Coverage and limits

- Reads download metadata from supported local Chromium-family browser profiles. History updates can lag; unfinished records without growth remain Unknown when pause state is unavailable.
- Observes writable outputs of your curl, wget, wget2 and aria2c processes. Most terminal downloads do not expose reliable total sizes or final outcomes. A stopped process is not proof of completion.
- Checks up to 500 top-level Downloads files for growth and partial-file markers. Other folders need a recognized downloader or previously observed output.
- No dedicated Firefox, torrent, package-manager or remote-machine integration. Private browser sessions are not covered.
- This is a monitor. It cannot start, cancel, pause or resume transfers. The Queue tab can display locally configured dependency requests; there is no automatic transfer execution. A fresh install includes no queue or download records.

Double-click a card to open its folder. Coverage explains the visible sources. Escape or Close exits without changing transfers; monitoring stops when the window closes.

## Local data

Observed transfer metadata is stored in ~/.local/state/download-monitor. Browser reads select download columns, not URLs, cookies or tokens. No data is sent to this website. This archive contains only reusable source, an installer and instructions. It contains no browser profiles, transfer history, personal filenames or preconfigured queue.

To uninstall, close the app and remove ~/.local/share/download-monitor, ~/.local/share/applications/local.download.Monitor.desktop and ~/.local/share/icons/hicolor/scalable/apps/local.download.Monitor.svg. Remove ~/.local/state/download-monitor separately if you also want to discard its local observations or queue.
