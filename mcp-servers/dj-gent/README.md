# DJ-gent

An MCP server that turns any MCP-compatible agent (OpenClaw, Claude Desktop, Claude Code) into a working DJ. Harmonic mixing on the Camelot wheel, slot planning, transition design, hot cue placement, energy curves and crowd-reading — shaped by built-in DJ personas.

## What it does

| Tool | What it does |
| --- | --- |
| `list_dj_personas` | List built-in personas — set style, BPM range, preferred Camelot keys, do/don't rules. |
| `get_persona_brief` | Markdown brief for a persona. Drop into the LLM as context before set-planning. |
| `harmonic_match` | Camelot-compatible keys for a given key, with mixing rules and energy switches. |
| `analyze_track` | Normalise track metadata into the DJ vocabulary — Camelot, BPM bracket, persona fit. |
| `suggest_next_track` | Rank candidates as the next track — harmonic, BPM, energy fit, with reasoning per pick. |
| `plan_set` | Phase-by-phase plan for a slot (warmup, peak, closing) with persona-aligned notes. |
| `build_transition` | Plan the move-by-move transition between two tracks. Picks a preset by analysis. |
| `cue_point_plan` | Suggest hot cue placements with bar/time hints based on track length. |
| `energy_curve` | Map an energy curve across tracks, flag dips and spikes that break the persona's arc. |
| `read_the_crowd` | Diagnose a crowd signal and return a concrete pivot move. |
| `list_transition_presets` | List every transition preset (long blend, EQ swap, loop tease + slam, double drop, filter sweep). |

## Setup

1. Install:
   ```
   cd mcp-servers/dj-gent
   npm install
   npm run build
   ```
2. Register with your MCP client. Example for Claude Desktop (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "dj-gent": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-servers/dj-gent/dist/index.js"],
         "env": {
           "DJ_GENT_DEFAULT_PERSONA": "warehouse-techno"
         }
       }
     }
   }
   ```

## Built-in personas

| id | lane | BPM |
| --- | --- | --- |
| `warehouse-techno` | melodic / driving techno, long blends | 122-134 |
| `peak-house` | tech house, tribal, peak-time | 126-132 |
| `sunrise` | closing slot, melodic and emotional | 118-124 |
| `warmup` | first hours, deep house and dub techno | 115-124 |

## Extending the library

Edit `dj-knowledge.json`. Add personas under `personas`, slot templates under `slot_templates`, transition presets under `transition_presets`, crowd signals under `crowd_signals`. The tools read straight from this file — no code changes needed.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `DJ_GENT_LIBRARY` | bundled file | Override path to `dj-knowledge.json`. |
| `DJ_GENT_DEFAULT_PERSONA` | first persona | Persona id used when the caller omits `persona`. |
