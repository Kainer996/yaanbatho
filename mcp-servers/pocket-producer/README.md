# Pocket Producer

An MCP server that turns any MCP-compatible agent (OpenClaw, Claude Desktop, Claude Code) into a working music producer. It ships with the signature style of **Kainer** and **Il Diablo** baked in and calls out to a self-hosted Suno proxy for audio generation.

## What it does

| Tool | What it does |
| --- | --- |
| `list_reference_tracks` | Return the full reference library (producers, style, own tracks). |
| `get_producer_style_brief` | Markdown style brief for a chosen producer. |
| `generate_track` | Generate a track via Suno, seeded with the producer's palette. |
| `get_generation_status` | Poll Suno clip ids for completion + audio URLs. |
| `critique_mix` | Return a mix-critique prompt anchored to the producer's fingerprint. |
| `suggest_chord_progression` | Roman-numeral progressions in the producer's common keys. |
| `arrangement_feedback` | Phase-by-phase feedback against the producer's typical arrangement. |
| `match_reference_style` | Pick closest tracks from the catalogue for a target vibe. |

## Setup

1. Stand up the Suno proxy separately — [gcui-art/suno-api](https://github.com/gcui-art/suno-api). Set your Suno cookie there; this server does not handle cookies.
2. Install this server:
   ```
   cd mcp-servers/pocket-producer
   npm install
   npm run build
   ```
3. Copy `.env.example` to `.env` and point `SUNO_API_BASE_URL` at your proxy (default `http://localhost:3000`).
4. Register with your MCP client. Example for Claude Desktop (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "pocket-producer": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/pocket-producer/dist/index.js"],
         "env": {
           "SUNO_API_BASE_URL": "http://localhost:3000",
           "POCKET_PRODUCER_DEFAULT_STYLE": "kainer"
         }
       }
     }
   }
   ```

## Extending the library

Edit `reference-tracks.json`. Every property is picked up at startup. To add a new producer, append to `producers`; to deepen an existing one, fill in track `notes` or expand `signature_style`. The tools read straight from this file — no code changes needed.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `SUNO_API_BASE_URL` | `http://localhost:3000` | Base URL of the Suno proxy. |
| `POCKET_PRODUCER_LIBRARY` | bundled file | Override path to `reference-tracks.json`. |
| `POCKET_PRODUCER_DEFAULT_STYLE` | first producer | Producer id used when the caller omits `style`. |
