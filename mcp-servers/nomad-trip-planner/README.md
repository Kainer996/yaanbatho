# Nomad Trip Planner

An MCP server that plans a short, van-friendly day trip — destination, weather window, daylight, and parkup — so a driver on a call never fiddles with Google Maps while moving. Ships with a bundled fixture of real UK spots so it runs offline on the first `npm run dev`.

## What it does

| Tool | What it does |
| --- | --- |
| `plan_day_trip` | Ranked candidates with drive time, weather, sunset, parkup, and Maps deeplinks. |
| `find_van_parkup` | Van-friendly parking near a coordinate. Pluggable provider. |
| `weather_window` | Hourly forecast + "best 3-hour window" rec. Open-Meteo by default. |
| `daylight` | Sunrise, sunset, solar noon, golden-hour. Computed locally — no API. |
| `quick_brief` | One-paragraph plain-text brief for TTS ("Read aloud" while driving). |

## Setup

```bash
cd mcp-servers/nomad-trip-planner
npm install
npm run build
```

Then register with your MCP client. Example for Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nomad-trip-planner": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/nomad-trip-planner/dist/index.js"],
      "env": {
        "NOMAD_WEATHER_PROVIDER": "open-meteo",
        "NOMAD_PARKUP_PROVIDER": "fixture",
        "NOMAD_DEFAULT_ANCHOR": "51.4545,-2.5879"
      }
    }
  }
}
```

## Running locally

```bash
npm run dev       # tsx watch mode, talks MCP over stdio
npm run typecheck # tsc --noEmit
```

The dev server expects an MCP client to speak to it. For a quick smoke test without an MCP client:

```bash
# Weather check (Open-Meteo, no key)
node --input-type=module -e "\
import { OpenMeteoProvider } from './src/weather.js';\
const w = new OpenMeteoProvider();\
console.log(await w.forecast(51.45, -2.58, new Date().toISOString().slice(0,10)));"
```

If `npm install` can't reach the npm registry (offline environment), the sources still typecheck against the bundled `@modelcontextprotocol/sdk` contract — see `tsconfig.json`.

## Providers

### Weather
- **open-meteo** (default) — https://api.open-meteo.com/v1/forecast, free, no key.
- **fixture** — offline synthesised forecast for demos/CI. Clearly labelled in the response payload.

### Parkups
- **fixture** (default) — reads `fixtures/parkups.sample.json` (bundled). Ten curated UK spots.
- **ioverlander** / **park4night** / **google-places** — stubs ready to wire up. Each throws a helpful error today so you see exactly where to plug the real provider in (`src/parkups.ts`).

## Extending the fixture

Edit `fixtures/parkups.sample.json`. Each entry needs `id`, `name`, `lat`, `lng`, `vibe[]`, and a `notes` string. The fixture provider reads it at startup — no rebuild required if you pass `NOMAD_PARKUP_FIXTURE` to an absolute path.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `NOMAD_WEATHER_PROVIDER` | `open-meteo` | `open-meteo` or `fixture`. |
| `NOMAD_PARKUP_PROVIDER` | `fixture` | `fixture` today; `ioverlander` / `park4night` / `google-places` stubs in `src/parkups.ts`. |
| `NOMAD_PARKUP_FIXTURE` | bundled | Override path to the parkup JSON. |
| `NOMAD_ASSUMED_KMH` | `60` | Average speed for drive-time estimates. |
| `NOMAD_DEFAULT_ANCHOR` | _unset_ | `lat,lng` used when the caller omits an origin. |

## Design notes

- **Offline-first.** The first `npm run dev` always returns something real because the parkup fixture and the daylight computation have no network dependency. Weather degrades to a synthesised fixture with `NOMAD_WEATHER_PROVIDER=fixture`.
- **No API keys in the fast path.** Open-Meteo is keyless. Parkups are local JSON. Google Maps deeplinks don't need a key — they open the user's installed Maps app.
- **Scoring.** Destinations are ranked by `best_window.score × 2 − drive_minutes × 0.2 + vibe_bonus + overnight_bonus`, with a small penalty if the candidate is over the driver's time budget.
- **Pluggable.** `ParkupProvider` and `WeatherProvider` are interfaces, not classes — swap in a real provider without touching the MCP tool layer.
