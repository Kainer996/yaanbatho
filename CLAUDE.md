# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dual-Stack Architecture

This repo contains **two parallel implementations** of the same personal site, living side-by-side in the root:

1. **Next.js 14 app** (App Router, TypeScript, Tailwind, MDX) — `app/`, `components/`, `lib/`, `content/`, `public/`, `next.config.js`, `package.json`.
2. **Static HTML/CSS/JS site** — `index.html`, `projects.html`, `bio.html`, `music.html`, `contact.html`, `now.html`, `uses.html`, `office.html`, `products.html`, plus `css/`, `js/`, `data/`. No build tools; opens directly in a browser and is what gets deployed to GitHub Pages (see `CNAME` → `yaanbatho.com`).

Changes to user-facing content usually need to be made **in both places** to stay in sync. The static site is the canonical published version; the Next.js app is an alternate implementation. When editing, confirm which target the user wants and check whether the other needs a mirrored change (project data lives in `content/projects/*.mdx` for Next.js and `data/projects.json` for static; music in `content/music/tracks.json` vs `data/tracks.json`).

## Common Commands (Next.js app)

```bash
npm run dev         # next dev — http://localhost:3000
npm run build       # next build
npm run start       # next start
npm run lint        # next lint (eslint-config-next + @typescript-eslint + prettier)
npm run typecheck   # tsc --noEmit (strict mode)
npm run format      # prettier --write on ts/tsx/md/mdx/json
npm run seed        # tsx scripts/seed.ts — generates SVG placeholders in public/projects and public/music, copies MP3s from ../tunes
```

No test runner is configured.

The static site has no build step — open the HTML files directly or serve the root with any static server.

## Next.js App Internals

### Content pipeline

- `lib/mdx.ts` reads MDX files from `content/` at request/build time via `fs` + `gray-matter`. `getProjects()` and `getProjectBySlug(slug)` are the only entry points; both are called from Server Components and the `/api/projects` route.
- `Project` interface in `lib/mdx.ts` is the source of truth for project frontmatter shape (`title`, `excerpt`, `date`, `tags[]`, `tech[]`, `cover?`, `repo?`, `liveUrl?`, `status?: "released" | "in-progress"`, `year?`).
- Project detail pages (`app/projects/[slug]/page.tsx`) use `generateStaticParams` over `getProjects()` for SSG and `next-mdx-remote/rsc` (`MDXRemote`) to render the body. MDX styling overrides live in `mdx-components.tsx` at the repo root (required location for `@next/mdx`).
- To add a project: create `content/projects/<slug>.mdx` with valid frontmatter, drop the cover image at `public/projects/<slug>.jpg`, and add the slug to `projectSlugs` in `scripts/seed.ts` if you want placeholder generation.

### Routing

App Router under `app/` — each folder is a route segment. Dynamic project pages at `app/projects/[slug]/page.tsx`. API routes at `app/api/projects/route.ts` (lists projects) and `app/api/upload/route.ts` (file upload gated by `UPLOAD_TOKEN` env var, defaults to `"yaan2026"`; saves to `public/uploads/`, 200 MB limit). SEO generated via `app/sitemap.ts` and `app/robots.ts`.

### Styling system

- Tailwind + CSS variables defined in `app/globals.css` under `:root`. Tokens (`--bg`, `--fg`, `--muted`, `--border`, `--glow`, `--accent`) are exposed as Tailwind colors in `tailwind.config.ts` (e.g. `bg-bg`, `text-fg`, `border-border`). Prefer these tokens over raw hex values — they're the cyber monochrome palette used everywhere.
- Dark mode is forced on `<html className="dark">` in `app/layout.tsx`; don't add light-mode variants.
- Custom keyframes `scanline` and `glow` are registered in `tailwind.config.ts`.
- `cn()` in `lib/utils.ts` is the standard class merger (`clsx` + `tailwind-merge`).

### Path aliases

`tsconfig.json` maps `@/*` to repo root. Use `@/components/...`, `@/lib/...`, `@/app/...` — not relative paths.

### Client vs Server components

Default to Server Components. Mark `"use client"` only when needed (framer-motion, hooks, event handlers). Existing client components: `app/page.tsx`, `components/ProjectCard.tsx`, `components/AudioPlayer.tsx`, `components/Header.tsx`, `components/GridBackground.tsx`.

### Animations

Framer Motion is the animation library. Always respect `prefers-reduced-motion` — the codebase targets WCAG AA+ and this is a hard requirement.

## Static Site Internals

- All pages are self-contained HTML with inline `<head>` SEO (canonical tags, OG, Twitter, JSON-LD). The homepage (`index.html`) has full Schema.org Person markup — keep it in sync with `about.txt` and `.well-known/ai.txt` when identity/project info changes.
- `css/style.css` holds the cyber palette as CSS variables under `:root`; mirror any Next.js color changes here.
- `js/main.js` handles mobile menu, nav active state, and the audio player class used across pages. `js/animations.js`, `js/mascot-v10.js`, `js/platform-nav-v10.js` are additional enhancements loaded per-page.
- Project data for the static site is `data/projects.json`; music in `data/tracks.json`. These are fetched client-side on the relevant pages.
- `sitemap.xml`, `robots.txt`, `about.txt`, `.well-known/ai.txt`, `.well-known/agent.json`, `.well-known/mcp.json`, `llms.txt` are all deployment artifacts — update dates/URLs when content changes before deploying.

## Deployment Notes

- Static site deploys to GitHub Pages via `CNAME` (`yaanbatho.com`). Root HTML files are the served pages.
- Next.js app is designed for Vercel (see `DEPLOYMENT.md`). No env vars required for basic operation; `UPLOAD_TOKEN` and `NEXT_PUBLIC_SITE_URL` are the only optional ones.
- robots.txt explicitly allow-lists AI crawlers (GPTBot, ChatGPT-User, CCBot, anthropic-ai, Claude-Web, Google-Extended) — this is intentional, don't tighten it without checking with the owner.

## Conventions to Follow

- Prettier config: 2-space tabs, semicolons, double quotes, `printWidth: 100`, `trailingComma: "es5"`. Run `npm run format` before committing non-trivial changes.
- ESLint rule enforced: `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"` — prefix intentionally unused args with `_`.
- Prefer `getProjects()` / `getProjectBySlug()` over re-reading the filesystem; they already parse frontmatter.
- When touching MDX content, make sure the frontmatter type-checks against `Project` in `lib/mdx.ts`; missing required fields will break `generateStaticParams`.

## Git Workflow

Active development branch for Claude-initiated work: `claude/create-claude-documentation-Om7bX`. Push with `git push -u origin <branch-name>`; do not push to other branches without explicit permission. Do not open a PR unless asked.
