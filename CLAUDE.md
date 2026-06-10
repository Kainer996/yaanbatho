# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

The source for **yaanbatho.com** — Yaan Batho's personal site plus a growing collection of mini-projects (games, agent tools, MCP servers). Two parallel site implementations live side by side in this repo:

1. **Static site at the repo root** (the actively developed live site): vanilla HTML/CSS/JS pages — `index.html`, `projects.html`, `bio.html`, `music.html`, `nomad*.html`, `office.html`, etc. — with shared assets in `css/`, `js/`, and JSON content in `data/` (`projects.json`, `tracks.json`). No build step; open the HTML files directly or serve the root statically.
2. **A Next.js 14 App Router app** (`app/`, `components/`, `content/`, `lib/`): TypeScript strict mode, Tailwind, Framer Motion, MDX content. It mirrors the static pages (`/`, `/projects`, `/bio`, `/music`, `/contact`, `/now`, `/uses`) and, importantly, hosts the **API routes** (`app/api/identify-sound`, `app/api/upload`, `app/api/projects`) that back the Burbz game and the upload tool. `app/nomadmax/page.tsx` just redirects to the static `nomad.html`.

Recent development happens almost entirely on the static side (check `git log`); the Next.js app is kept for its API routes and the VPS deployment. **Content is duplicated** between the two: projects in `data/projects.json` vs `content/projects/*.mdx`, tracks in `data/tracks.json` vs `content/music/tracks.json`. When changing content, check whether both need updating.

## Sub-projects

- **`public/burbz/`** — BURBZ, a Pokémon-style bird-spotting game (vanilla JS, single large `index.html`). Served at `/burbz/` by Next.js and **deployed standalone to GitHub Pages** by `.github/workflows/pages.yml` (triggers only on changes under `public/burbz/**`). Uses the eBird API client-side and the `/api/identify-sound` route (Claude vision on a spectrogram) server-side. PRs touching it use the `BURBZ:` commit prefix.
- **`tap-town/`** — Tap Town browser game, a self-contained PWA (`index.html`, `sw.js`, `manifest.webmanifest`).
- **`mcp-servers/nomad-trip-planner/`** and **`mcp-servers/pocket-producer/`** — standalone TypeScript MCP servers (`@modelcontextprotocol/sdk` + `zod`). Each has its own `package.json`, lockfile, and tsconfig, and is **excluded from the root tsconfig** — install and build them inside their own directories, not from the repo root.
- **Single-page static apps**: `nomad.html` (Nomad Max hub), `nomad-pub-guide.html`, `nomad-roll-call.html`, `nomad-trip-planner*.html`, `pocket-producer.html`, `agent-tools.html`, plus `jdr/`, `mission-control/`, `nomadmax/` folders with their own `index.html`.
- **Agent-facing metadata**: `llms.txt`, `agent-catalog.json`, `.well-known/` (`agent.json`, `mcp.json`, `ai-plugin.json`, `ai.txt`) describe the site's tools to AI agents. Keep these in sync when adding or renaming a product/tool page.

## Commands

Root (Next.js app — npm and pnpm both work; lockfile is npm's):

```bash
npm install
npm run dev        # Next.js dev server on :3000
npm run build      # production build (also the main CI-equivalent sanity check)
npm run start      # serve production build
npm run lint       # ESLint (next lint)
npm run typecheck  # tsc --noEmit
npm run format     # Prettier over ts/tsx/md/mdx/json
npm run seed       # tsx scripts/seed.ts — creates placeholder images, copies music
```

MCP servers (run inside `mcp-servers/<name>/`):

```bash
npm install
npm run dev        # tsx src/index.ts
npm run build      # tsc → dist/
npm run typecheck
```

There is **no test suite** anywhere in the repo. Verify changes with `npm run typecheck`, `npm run lint`, and `npm run build` for TypeScript work, or by opening the relevant HTML page for static work.

## Deployment

- **GitHub Pages** (`.github/workflows/pages.yml`): deploys *only* `public/burbz/` on pushes to `main` that touch it. The root `CNAME` (`yaanbatho.com`) pins the custom domain.
- **VPS** (`scripts/deploy-vps.sh`): idempotent one-shot bootstrap for an Ubuntu box — Node 20, Caddy with auto-TLS, a `yaanbatho` systemd service running `npm run start`. It deploys from `origin/main` and reads env from `/etc/yaanbatho.env`. Server-side env vars: `ANTHROPIC_API_KEY` (required by `/api/identify-sound`) and `UPLOAD_TOKEN` (gates `/api/upload`).

## Conventions

- **Commit messages** use an area prefix seen throughout history: `BURBZ: …`, `infra: …`, or a plain description for site pages. Most work lands via PRs to `main`.
- **TypeScript paths**: `@/*` maps to the repo root (so `@/lib/mdx`, `@/components/Header`).
- **Formatting**: Prettier — semicolons, double quotes, 100-char lines, 2-space indent. ESLint ignores `public/` and `*.config.js`.
- **Design language**: monochrome "cyber" aesthetic (near-black backgrounds, `#EDEDED` foreground, grid backgrounds, glass effects, scanlines). Tokens are CSS variables in `css/style.css` (`:root`) for the static site and `app/globals.css` for Next.js. New static pages should reuse `css/style.css` and `js/main.js` patterns rather than inventing new styling.
- **Static pages are self-contained on purpose** — large inline `<style>`/`<script>` blocks in a single HTML file are the norm for the game/tool pages (Burbz, Tap Town, Nomad tools). Match that style instead of introducing a bundler.
- Markdown docs at the root (`README.md`, `STATIC-SITE-README.md`, `DEPLOYMENT.md`, `PROJECT_SUMMARY.md`, `NOMAD-TRIP-PLANNER.md`, `SEO-README.md`) describe specific slices of the repo; `README.md` covers the Next.js app only and `STATIC-SITE-README.md` covers the static site.
