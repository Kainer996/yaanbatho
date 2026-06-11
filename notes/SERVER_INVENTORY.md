# Server inventory — yaanbatho.com

Snapshot of what lives on the AWS host at `/home/ubuntu/yaanbatho`
and how it maps to the repo. Written 2026-04-15 during the
`claude/organise-server-state` sync.

## Site root

Served by nginx (`/etc/nginx/sites-enabled/yaanbatho`, `root /home/ubuntu/yaanbatho`).
Plain static HTML/CSS/JS — no build step required for the public site.

## Folders added or organised in this sync

- `api/` — small Node services. Currently holds `chat-proxy.js` (Cosmo chat → Ollama on `127.0.0.1:8097`).
- `burbz/` — BURBZ bird-fighter game. `index.html` + `server.py` (Flask) + `README.md`. The Python venv at `burbz/venv/` is gitignored.
- `css/mascot-v{10..20}.css`, `css/mascot.css` — iterations of the spaceman mascot styling. Live site uses **v19**.
- `css/platform-nav-v{10..19}.css`, `css/platform-nav.css` — companion nav-platform styling for the mascot. Live site uses **v19**.
- `css/dj-decks.css`, `js/dj-decks.js`, `images/dj-decks-bg.jpg` — DJ-decks experience assets.
- `js/cosmo-chat.js` — front-end client for `api/chat-proxy.js`.
- `js/mascot-v{10..20}.js`, `js/mascot.js` — mascot behaviour iterations.
- `js/platform-nav-v{10..19}.js`, `js/platform-nav.js` — nav-platform behaviour iterations.
- `gallery.html` + `images/gallery/` — public gallery. Baseline placeholders (`art-placeholder-1.jpg`, `art-placeholder-2.jpg`, `gallery-hero.jpg`) are committed; runtime user uploads (`${timestamp}-*.{jpg,png,…}`) are gitignored.
- `space/index.html` — standalone "space" microsite/page.
- `strategy/index.html` — standalone "strategy" microsite/page.
- `upload-server.js` — Express upload backend, port 8095, proxied via nginx at `/gallery-upload/`. Reads `UPLOAD_TOKEN` from env (defaults to `'yaan2026'` if unset — change before exposing publicly).
- `upload.html` — admin UI form for uploads.
- `images/` — added: `gallery-card.jpg`, `logo-mascot-nobg.png`, `logo-no-bg.png`, `logo-original-backup.png`, `yaan_face_clean.png`, `yaan_face_sq.png`, `yaan_face_v2.jpg`.
- `public/projects/*.svg` — 13 vector versions of project cards (companions to existing `.jpg`s).

## Folders left untouched (already tracked or not in scope)

- `app/`, `components/`, `lib/`, `content/`, `scripts/`, `mdx-components.tsx`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json` — Next.js scaffold (not the live serving path; nginx serves the static `*.html` at root).
- `data/projects.json`, `data/tracks.json` — already tracked. Runtime-written `data/gallery-items.json` is gitignored.
- `images/` (pre-existing assets), `videos/`, `music/`, `public/`, `mission-control/`, `jdr/` — already tracked.
- `*.html` at root (`index.html`, `projects.html`, `products.html`, `bio.html`, `music.html`, `contact.html`, `now.html`, `office.html`, `agent-tools.html`, `uses.html`) — already tracked.

## Gitignored runtime / dependency state (files remain on disk)

- `node_modules/`, `.next/`, `out/`, `build/` — Next.js / npm build artefacts.
- `burbz/venv/`, `**/venv/`, `**/__pycache__/`, `*.pyc` — Python runtime.
- `*.log`, `*.pid` — process state.
- `images/gallery/[0-9]*` — user-uploaded gallery files (timestamp-prefixed by `upload-server.js`).
- `data/gallery-items.json` — runtime metadata written by `upload-server.js`.
- `.env`, `.env*.local`, `*.pem`, `*.key`, `id_rsa*`, `credentials.*`, `keys.json` — secrets guard. None currently present on the box.

## Commits in this branch (`claude/organise-server-state` ahead of `main`)

1. `8fa902b` — Move graffiti logo from hero overlay to below hero banner (#4) *(came from origin/main, base of rebase)*
2. `3197918` — Add mascot iterations v11..v20 and platform-nav v11..v19
3. `24a9094` — Switch homepage to mascot v19
4. `41ef8c5` — Add cosmo-chat, dj-decks, and supporting image assets
5. `cbac3bb` — Add gallery page, baseline gallery placeholders, and project SVGs
6. `1fd1f0e` — Add space and strategy pages
7. `8b386ee` — Add Cosmo chat API proxy (Ollama, localhost:8097)
8. `708d426` — Add BURBZ bird-fighter game source (HTML + Python server)
9. `cb0c9a4` — Add gallery upload server and admin upload UI
10. `6f51626` — Update .gitignore for python venvs, gallery uploads, and runtime state

## Bucket F items (still need a decision)

None at the time of writing. Everything untracked was either committed (buckets A/B) or gitignored (C/D/E). Open questions for future review:

- `upload-server.js` ships a hardcoded fallback token `'yaan2026'`. Set `UPLOAD_TOKEN=…` in the systemd/pm2 env and consider removing the default.
- `public/projects/friend-shaped/` is an empty directory; git can't track it. Drop a `.gitkeep` if you want it preserved in the repo.
