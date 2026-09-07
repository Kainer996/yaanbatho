# Telly

A classic television cabinet for official BBC iPlayer, ITVX and Channel 4 pages, with 16 channel presets.

## Requirements

Built and tested on Omarchy Linux (x86-64). Requires system Python 3.10+ with PySide6 (Qt 6), Node.js 18+ on PATH, and X11 or XWayland with libX11. The browser installer requires curl, ar (binutils), tar and xz. No Windows or macOS build is provided.

## Install and open

Extract the ZIP, open a terminal in the telly-source folder, then run:

```sh
bash install.sh
bash "$HOME/.local/share/telly/launch.sh"
```

The installer checks Python/PySide6 and Node, then installs into ~/.local/share/telly and adds Telly to the application launcher. If Google Chrome is absent, it downloads a private x86-64 Chrome runtime directly from Google. Chrome itself is not bundled in this source ZIP. Run the installer as your ordinary desktop user, without sudo.

Choose a channel, then use Sign in on the cabinet. Sign in yourself in the normal Chrome window, close that window, and use the broadcaster's Watch live control. Viewing and sign-in share a dedicated local profile. The providers control account access, location restrictions and playback.

Close × stays visible in fullscreen. Escape exits fullscreen first, then closes the normal window. Drag the title area to move and the edges to resize. On a tiling desktop, use your window manager's floating-window control if needed. No top-bar or window-manager settings are changed by this package.

## Playback status

Authenticated broadcaster playback has not yet been verified. Loading a channel page and detecting Widevine do not establish successful video playback. ITVX does not officially list Linux support. This is an independent desktop app using the official broadcaster pages; it is not an embedded TV stream on the portfolio website.

## Local data and maintenance

Chrome stores sign-ins in ~/.config/telly/profile by default. Telly does not import or extract credentials. Settings and the selected channel stay local. This archive contains only application source and instructions, with no browser runtime, profile or saved settings.

Close Telly before updating its private browser:

```sh
bash "$HOME/.local/share/telly/update-browser.sh"
```

To uninstall, close Telly and remove ~/.local/share/telly, ~/.local/share/applications/telly.desktop and ~/.local/share/icons/hicolor/scalable/apps/telly.svg. Remove ~/.config/telly only if you also want to delete local settings and sign-ins.
