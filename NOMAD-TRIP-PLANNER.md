# Nomad Trip Planner

> Hey — you asked me to remind you about this on Friday. Here it is.

You were driving, the weather was good, and you wanted to go *somewhere new but not too far from work*. Picking that on Google Maps while behind the wheel is awful and a bit dangerous. So we built an agent for it.

## What it is

An MCP server + landing page + dashboard that turns "plan my Friday" into one paragraph and one tap. You give it your work anchor, a drive-time budget, and a vibe. It picks 2–3 parking-aware destinations, checks live weather, computes daylight, recommends a parkup, and hands you a Google Maps deeplink plus a one-paragraph brief you can have read aloud.

## Try it in 60 seconds (no install)

Open the dashboard locally:

```
open nomad-trip-planner-dashboard.html
```

Or once this branch is merged to `main` and deployed:

- **Live URL:** https://yaanbatho.com/nomad-trip-planner-dashboard.html
- **Landing page:** https://yaanbatho.com/nomad-trip-planner.html

The dashboard works on your Android phone. Hit "Use my location", set drive time, pick a vibe, tap **Plan my Friday**. Hit the speaker button on a card to have the brief read aloud through your van speakers via Bluetooth.

## Try the MCP server

```bash
cd mcp-servers/nomad-trip-planner
npm install
npm run build
npm run dev
```

Then register with your MCP client (Claude Desktop, OpenClaw, Claude Code):

```jsonc
{
  "mcpServers": {
    "nomad-trip-planner": {
      "command": "node",
      "args": ["/absolute/path/mcp-servers/nomad-trip-planner/dist/index.js"],
      "env": {
        "NOMAD_WEATHER_PROVIDER": "open-meteo",
        "NOMAD_PARKUP_PROVIDER": "fixture",
        "NOMAD_DEFAULT_ANCHOR": "51.4545,-2.5879"
      }
    }
  }
}
```

Then ask: *"Plan my Friday — 60 minutes max, somewhere scenic, avoid rain."*

## What's in the box

- `mcp-servers/nomad-trip-planner/` — TypeScript MCP server. Tools: `plan_day_trip`, `find_van_parkup`, `weather_window`, `daylight`, `quick_brief`. Pluggable provider interfaces for weather and parkups, so swapping in iOverlander/Park4Night later is a one-file change.
- `nomad-trip-planner.html` — landing page in the house style.
- `nomad-trip-planner-dashboard.html` — single-file static dashboard. Vanilla JS, no build, real Open-Meteo calls, inline NOAA sunset math, 10 curated UK spots, browser TTS for the brief.
- `agent-catalog.json` — new entry, `last_updated` bumped.

## What's next (the punch list)

- [ ] Wire iOverlander provider (it has a public read API; needs a polite UA + caching).
- [ ] Wire Park4Night provider (paid API; defer until subs justify it).
- [ ] Replace browser `speechSynthesis` with ElevenLabs Pro voice for the in-cab brief.
- [ ] iOS Shortcut that hits the MCP server over a small HTTP bridge so Siri can trigger it from CarPlay.
- [ ] Android equivalent — Tasker recipe + a PWA installable from the dashboard URL.
- [ ] Offline mode: cache last 7 days of weather + the full parkup fixture so a dropped 4G signal doesn't kill the trip.
- [ ] Add a "loop home before sunset" planner mode — picks a destination such that you're parked by golden hour.
- [ ] Add a "near my route" mode — give it a meeting location, get parkup suggestions on the way back.
- [ ] Write a small `seed.ts` that pulls a few hundred real UK parkups into the fixture from open data.
- [ ] CarPlay-safe page that shows ONE big destination card and ONE big "Open in Maps" button.

## Why this matters

You spend a lot of the week parked somewhere that isn't home. Tools that respect *driving cognition* — short, voiced, single-tap — are the difference between "this agent is helpful" and "this agent is a hazard". Nomad Trip Planner is the first one in this catalog built for that constraint specifically. If it works for a real parking-aware travel day, it should work for the next person who finds the site.

— Built on branch `claude/nomad-trip-planner-agent-U0Xjn`. Yaan & Ava.
