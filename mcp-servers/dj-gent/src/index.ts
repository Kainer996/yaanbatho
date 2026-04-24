#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  bpmCompatibility,
  compatibleCamelot,
  findPersona,
  loadLibrary,
  normalizeCamelot,
  renderPersonaBrief,
} from "./knowledge.js";

const server = new Server(
  {
    name: "dj-gent",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const library = loadLibrary();

const PersonaId = z
  .string()
  .describe("DJ persona id, e.g. 'warehouse-techno' or 'peak-house'. Omit to use the default.");

const TrackSchema = z
  .object({
    title: z.string().min(1),
    artist: z.string().optional(),
    bpm: z.number().positive().optional(),
    camelot: z.string().optional(),
    energy: z.number().min(1).max(10).optional(),
    duration_seconds: z.number().positive().optional(),
    notes: z.string().optional(),
  })
  .strict();

const tools = [
  {
    name: "list_dj_personas",
    description:
      "List the built-in DJ personas — set style, BPM range, preferred Camelot keys, do/don't rules. Use this first when planning a set.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    schema: z.object({}).strict(),
    handler: async () => {
      return {
        personas: library.personas.map((p) => ({
          id: p.id,
          name: p.name,
          bio: p.bio,
          set_style: p.set_style,
        })),
      };
    },
  },
  {
    name: "get_persona_brief",
    description:
      "Return a markdown brief for a DJ persona — energy arc, transition styles, do/don't rules. Drop this into the LLM as context before set-planning.",
    inputSchema: {
      type: "object",
      properties: { persona: { type: "string" } },
      additionalProperties: false,
    },
    schema: z.object({ persona: PersonaId.optional() }).strict(),
    handler: async ({ persona }: { persona?: string }) => {
      const p = findPersona(library, persona);
      return { persona_id: p.id, brief_markdown: renderPersonaBrief(p) };
    },
  },
  {
    name: "harmonic_match",
    description:
      "Given a Camelot key (like '8A'), return harmonically compatible keys with mixing rules — perfect match, fifth up/down, energy switch, and bolder options. Use this when picking the next track.",
    inputSchema: {
      type: "object",
      properties: {
        camelot: { type: "string", description: "Camelot key, e.g. '8A' or '11B'." },
      },
      required: ["camelot"],
      additionalProperties: false,
    },
    schema: z.object({ camelot: z.string().min(2) }).strict(),
    handler: async ({ camelot }: { camelot: string }) => {
      const normalized = normalizeCamelot(camelot);
      const compat = compatibleCamelot(normalized);
      const wheel = library.camelot_wheel.keys.find((k) => k.camelot === normalized);
      return {
        input: normalized,
        musical_key: wheel?.key,
        openkey: wheel?.openkey,
        compatible: compat,
      };
    },
  },
  {
    name: "analyze_track",
    description:
      "Normalise track metadata into the DJ vocabulary — Camelot, BPM bracket, energy bucket, persona fit. Pass whatever you know; the rest is left blank, not guessed.",
    inputSchema: {
      type: "object",
      properties: {
        track: { type: "object" },
        persona: { type: "string" },
      },
      required: ["track"],
      additionalProperties: false,
    },
    schema: z
      .object({
        track: TrackSchema,
        persona: PersonaId.optional(),
      })
      .strict(),
    handler: async ({ track, persona }: { track: z.infer<typeof TrackSchema>; persona?: string }) => {
      const p = findPersona(library, persona);
      const camelot = track.camelot ? normalizeCamelot(track.camelot) : undefined;
      const wheel = camelot
        ? library.camelot_wheel.keys.find((k) => k.camelot === camelot)
        : undefined;
      const bpmInRange =
        track.bpm !== undefined &&
        track.bpm >= p.set_style.bpm_range[0] &&
        track.bpm <= p.set_style.bpm_range[1];
      const keyPreferred = camelot ? p.set_style.preferred_keys_camelot.includes(camelot) : null;
      return {
        track,
        persona: p.id,
        normalised: {
          camelot,
          musical_key: wheel?.key,
          openkey: wheel?.openkey,
          bpm: track.bpm,
          energy: track.energy,
        },
        fit: {
          bpm_in_persona_range: track.bpm === undefined ? null : bpmInRange,
          key_in_persona_preferred: keyPreferred,
          notes_for_set: [
            track.bpm === undefined ? "BPM unknown — analyse the file before slotting" : null,
            camelot === undefined ? "Key unknown — run a key-detect pass" : null,
            track.energy === undefined ? "Energy unrated — assign 1-10 before set planning" : null,
          ].filter(Boolean),
        },
      };
    },
  },
  {
    name: "suggest_next_track",
    description:
      "Given the currently-playing track and a candidate crate, rank the candidates as next-track choices — harmonic, BPM, energy fit, with one-line reasoning per pick.",
    inputSchema: {
      type: "object",
      properties: {
        current: { type: "object" },
        candidates: { type: "array", items: { type: "object" } },
        target_energy_delta: {
          type: "number",
          description: "Desired change in energy (1-10 scale). +1 lifts, -1 calms, 0 holds.",
        },
        persona: { type: "string" },
      },
      required: ["current", "candidates"],
      additionalProperties: false,
    },
    schema: z
      .object({
        current: TrackSchema,
        candidates: z.array(TrackSchema).min(1),
        target_energy_delta: z.number().optional(),
        persona: PersonaId.optional(),
      })
      .strict(),
    handler: async ({
      current,
      candidates,
      target_energy_delta,
      persona,
    }: {
      current: z.infer<typeof TrackSchema>;
      candidates: z.infer<typeof TrackSchema>[];
      target_energy_delta?: number;
      persona?: string;
    }) => {
      const p = findPersona(library, persona);
      const currentCamelot = current.camelot ? normalizeCamelot(current.camelot) : undefined;
      const compat = currentCamelot ? compatibleCamelot(currentCamelot) : undefined;
      const compatSet = compat
        ? new Set([compat.same, compat.fifth_up, compat.fifth_down, compat.energy_switch, ...compat.bold])
        : undefined;

      const scored = candidates.map((c) => {
        const camelot = c.camelot ? normalizeCamelot(c.camelot) : undefined;
        const harmonicScore = (() => {
          if (!compatSet || !camelot) return 0;
          if (camelot === compat?.same) return 5;
          if (camelot === compat?.fifth_up || camelot === compat?.fifth_down) return 4;
          if (camelot === compat?.energy_switch) return 3;
          if (compat?.bold.includes(camelot)) return 1;
          return 0;
        })();
        const bpmScore = (() => {
          if (current.bpm === undefined || c.bpm === undefined) return 0;
          const { verdict } = bpmCompatibility(current.bpm, c.bpm);
          return { lock: 5, safe: 4, stretch: 2, no: 0 }[verdict];
        })();
        const energyScore = (() => {
          if (current.energy === undefined || c.energy === undefined) return 0;
          const target = current.energy + (target_energy_delta ?? 0);
          const distance = Math.abs(c.energy - target);
          return Math.max(0, 5 - distance);
        })();
        const personaFit = (() => {
          if (c.bpm === undefined) return 0;
          return c.bpm >= p.set_style.bpm_range[0] && c.bpm <= p.set_style.bpm_range[1] ? 2 : 0;
        })();
        const total = harmonicScore + bpmScore + energyScore + personaFit;
        const reasons: string[] = [];
        if (harmonicScore >= 4) reasons.push(`harmonic: ${camelot} mixes cleanly out of ${currentCamelot}`);
        else if (harmonicScore === 3) reasons.push(`energy switch: ${camelot} flips mood from ${currentCamelot}`);
        else if (harmonicScore === 1) reasons.push(`bold harmonic — works only if you EQ-kill the lead`);
        else if (harmonicScore === 0 && camelot) reasons.push(`harmonic clash — needs breakdown bridge`);
        if (current.bpm !== undefined && c.bpm !== undefined) {
          const compatBpm = bpmCompatibility(current.bpm, c.bpm);
          reasons.push(`bpm: ${compatBpm.delta} delta (${compatBpm.verdict})`);
        }
        if (current.energy !== undefined && c.energy !== undefined) {
          const dir = c.energy > current.energy ? "lift" : c.energy < current.energy ? "calm" : "hold";
          reasons.push(`energy ${current.energy}→${c.energy} (${dir})`);
        }
        if (personaFit > 0) reasons.push(`fits ${p.name} bpm window`);
        return { candidate: c, score: total, reasons };
      });

      scored.sort((a, b) => b.score - a.score);
      return {
        persona: p.id,
        from: current,
        target_energy_delta: target_energy_delta ?? 0,
        ranked: scored,
        guidance: compat
          ? `Aim for ${compat.same}, ${compat.fifth_up} or ${compat.fifth_down}. Use ${compat.energy_switch} for an energy switch.`
          : "No key on the current track — pick on BPM and energy alone, then trust your ears.",
      };
    },
  },
  {
    name: "plan_set",
    description:
      "Generate a phase-by-phase plan for a slot — warmup, peak, or closing. Returns the slot template, BPM drift per phase, energy targets and persona-aligned notes.",
    inputSchema: {
      type: "object",
      properties: {
        slot: {
          type: "string",
          description: "Slot template id, e.g. 'warmup-90', 'peak-120', 'closing-120'.",
        },
        persona: { type: "string" },
        venue: { type: "string", description: "Optional context — club, festival, terrace, radio." },
        duration_minutes: {
          type: "number",
          description: "Optional override for total slot length. Phases scale proportionally.",
        },
      },
      required: ["slot"],
      additionalProperties: false,
    },
    schema: z
      .object({
        slot: z.string().min(1),
        persona: PersonaId.optional(),
        venue: z.string().optional(),
        duration_minutes: z.number().positive().optional(),
      })
      .strict(),
    handler: async ({
      slot,
      persona,
      venue,
      duration_minutes,
    }: {
      slot: string;
      persona?: string;
      venue?: string;
      duration_minutes?: number;
    }) => {
      const p = findPersona(library, persona);
      const template = library.slot_templates.find((t) => t.id === slot);
      if (!template) {
        throw new Error(
          `Unknown slot template "${slot}". Available: ${library.slot_templates.map((t) => t.id).join(", ")}`,
        );
      }
      const baseTotal = template.phases.reduce((sum, ph) => sum + ph.minutes, 0);
      const total = duration_minutes ?? baseTotal;
      const scale = total / baseTotal;
      const phases = template.phases.map((ph) => ({
        ...ph,
        minutes: Math.round(ph.minutes * scale),
      }));
      const tracksEstimate = Math.round(
        total / ((p.set_style.track_length_minutes[0] + p.set_style.track_length_minutes[1]) / 2),
      );
      return {
        persona: p.id,
        slot: template.id,
        slot_name: template.name,
        venue,
        total_minutes: total,
        estimated_tracks: tracksEstimate,
        phases,
        persona_alignment: {
          bpm_range: p.set_style.bpm_range,
          preferred_keys: p.set_style.preferred_keys_camelot,
          energy_arc: p.set_style.energy_arc,
          do: p.set_style.do,
          dont: p.set_style.dont,
        },
        next_steps: [
          "Pick anchor tracks per phase, in persona's preferred Camelot keys",
          "Lay out a Camelot path across the set — same number for blends, +/- 1 for lift",
          "Place the biggest record in the highest-energy phase",
          "Mark cue points on every track using the cue_point_template tool before doors",
        ],
      };
    },
  },
  {
    name: "build_transition",
    description:
      "Given two tracks, plan the transition. Picks a preset (long blend, EQ swap, loop tease + slam, double drop, filter sweep) based on BPM delta and key compatibility, returns the move-by-move plan.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "object" },
        to: { type: "object" },
        preset: {
          type: "string",
          description: "Optional preset id to force, e.g. 'long-blend', 'eq-swap', 'loop-tease-slam', 'double-drop', 'filter-sweep'.",
        },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
    schema: z
      .object({
        from: TrackSchema,
        to: TrackSchema,
        preset: z.string().optional(),
      })
      .strict(),
    handler: async ({
      from,
      to,
      preset,
    }: {
      from: z.infer<typeof TrackSchema>;
      to: z.infer<typeof TrackSchema>;
      preset?: string;
    }) => {
      const fromCamelot = from.camelot ? normalizeCamelot(from.camelot) : undefined;
      const toCamelot = to.camelot ? normalizeCamelot(to.camelot) : undefined;
      const compat = fromCamelot ? compatibleCamelot(fromCamelot) : undefined;
      const harmonic = (() => {
        if (!compat || !toCamelot) return "unknown";
        if (toCamelot === compat.same) return "perfect";
        if (toCamelot === compat.fifth_up || toCamelot === compat.fifth_down) return "fifth";
        if (toCamelot === compat.energy_switch) return "energy-switch";
        if (compat.bold.includes(toCamelot)) return "bold";
        return "clash";
      })();
      const bpmCompat = from.bpm !== undefined && to.bpm !== undefined ? bpmCompatibility(from.bpm, to.bpm) : null;

      const choosePreset = (): string => {
        if (preset) return preset;
        if (harmonic === "clash") return "filter-sweep";
        if (bpmCompat && bpmCompat.delta > 3) return "filter-sweep";
        if (harmonic === "perfect" && bpmCompat && bpmCompat.delta < 1) return "long-blend";
        if (harmonic === "energy-switch") return "loop-tease-slam";
        if (harmonic === "perfect" || harmonic === "fifth") return "eq-swap";
        return "filter-sweep";
      };

      const chosen = choosePreset();
      const presetDef = library.transition_presets.find((p) => p.id === chosen);
      if (!presetDef) {
        throw new Error(
          `Unknown preset "${chosen}". Available: ${library.transition_presets.map((p) => p.id).join(", ")}`,
        );
      }
      return {
        from: { ...from, camelot: fromCamelot },
        to: { ...to, camelot: toCamelot },
        analysis: {
          harmonic,
          bpm: bpmCompat,
          camelot_guidance: compat
            ? { perfect: compat.same, fifths: [compat.fifth_up, compat.fifth_down], energy_switch: compat.energy_switch }
            : null,
        },
        chosen_preset: presetDef.id,
        preset: presetDef,
        warnings: [
          harmonic === "clash" ? "Harmonic clash — kill the lead and bridge through a breakdown" : null,
          bpmCompat && bpmCompat.delta > 5 ? "BPM gap too wide — schedule a 4-bar loop ramp instead of a live mix" : null,
          chosen === "double-drop" && (!bpmCompat || bpmCompat.delta > 0.5)
            ? "Double drop requested but BPM not locked — risk of phase drift"
            : null,
        ].filter(Boolean),
      };
    },
  },
  {
    name: "cue_point_plan",
    description:
      "Suggest hot cue placements for a track. Returns the 8-cue template with bar/time hints based on track length. Pair with the persona's transition styles.",
    inputSchema: {
      type: "object",
      properties: {
        track: { type: "object" },
        bars_per_phrase: { type: "number", description: "Default 16. Use 32 for melodic techno, 8 for short hooks." },
        persona: { type: "string" },
      },
      required: ["track"],
      additionalProperties: false,
    },
    schema: z
      .object({
        track: TrackSchema,
        bars_per_phrase: z.number().int().positive().optional(),
        persona: PersonaId.optional(),
      })
      .strict(),
    handler: async ({
      track,
      bars_per_phrase,
      persona,
    }: {
      track: z.infer<typeof TrackSchema>;
      bars_per_phrase?: number;
      persona?: string;
    }) => {
      const p = findPersona(library, persona);
      const phrase = bars_per_phrase ?? 16;
      const bpm = track.bpm ?? (p.set_style.bpm_range[0] + p.set_style.bpm_range[1]) / 2;
      const secondsPerBar = (60 / bpm) * 4;
      const secondsPerPhrase = secondsPerBar * phrase;
      const total = track.duration_seconds;
      const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const r = Math.round(s % 60);
        return `${m}:${String(r).padStart(2, "0")}`;
      };
      const annotated = library.cue_point_template.cues.map((cue, i) => {
        const phraseIndex = [0, 1, 4, 7, total ? Math.floor(total / secondsPerPhrase) - 1 : 9, 5, 3, total ? Math.floor(total / secondsPerPhrase) : 10][i] ?? i;
        const seconds = Math.max(0, phraseIndex * secondsPerPhrase);
        return {
          ...cue,
          phrase: phraseIndex,
          approx_seconds: Math.round(seconds),
          approx_time: formatTime(seconds),
        };
      });
      return {
        persona: p.id,
        track,
        seconds_per_bar: Math.round(secondsPerBar * 100) / 100,
        seconds_per_phrase: Math.round(secondsPerPhrase * 100) / 100,
        bars_per_phrase: phrase,
        cues: annotated,
        notes: library.cue_point_template.description,
      };
    },
  },
  {
    name: "energy_curve",
    description:
      "Map an energy curve across a list of tracks for a slot. Returns expected vs actual energy per track with notes on dips and spikes that don't fit the persona's arc.",
    inputSchema: {
      type: "object",
      properties: {
        tracks: { type: "array", items: { type: "object" } },
        slot: { type: "string", description: "Slot template id." },
        persona: { type: "string" },
      },
      required: ["tracks"],
      additionalProperties: false,
    },
    schema: z
      .object({
        tracks: z.array(TrackSchema).min(1),
        slot: z.string().optional(),
        persona: PersonaId.optional(),
      })
      .strict(),
    handler: async ({
      tracks,
      slot,
      persona,
    }: {
      tracks: z.infer<typeof TrackSchema>[];
      slot?: string;
      persona?: string;
    }) => {
      const p = findPersona(library, persona);
      const slotDef = slot ? library.slot_templates.find((t) => t.id === slot) : undefined;
      const points = tracks.map((t, i) => ({
        index: i,
        title: t.title,
        bpm: t.bpm,
        camelot: t.camelot ? normalizeCamelot(t.camelot) : undefined,
        energy: t.energy ?? null,
      }));
      const flags: string[] = [];
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1].energy;
        const b = points[i].energy;
        if (a === null || b === null) continue;
        const delta = b - a;
        if (delta <= -3) flags.push(`Track ${i} drops energy ${a}→${b} (delta ${delta}) — too steep, expect floor empty`);
        if (delta >= 4) flags.push(`Track ${i} spikes energy ${a}→${b} (delta ${delta}) — risks over-peaking`);
      }
      return {
        persona: p.id,
        slot: slotDef?.id,
        target_arc: p.set_style.energy_arc,
        track_count: tracks.length,
        curve: points,
        flags,
        recommendations: flags.length
          ? ["Reorder flagged tracks", "Insert a bridge track between dips and spikes", "Use a filter-sweep transition to soften the largest delta"]
          : ["Curve respects the persona's arc — proceed"],
      };
    },
  },
  {
    name: "read_the_crowd",
    description:
      "Given a crowd signal (e.g. 'phones up', 'front row backing off', 'talking gets louder') return the diagnosis and a concrete pivot move.",
    inputSchema: {
      type: "object",
      properties: {
        signal: { type: "string" },
        persona: { type: "string" },
      },
      required: ["signal"],
      additionalProperties: false,
    },
    schema: z
      .object({
        signal: z.string().min(1),
        persona: PersonaId.optional(),
      })
      .strict(),
    handler: async ({ signal, persona }: { signal: string; persona?: string }) => {
      const p = findPersona(library, persona);
      const lower = signal.toLowerCase();
      const match = library.crowd_signals.find((s) => lower.includes(s.signal.toLowerCase()) || s.signal.toLowerCase().includes(lower));
      return {
        persona: p.id,
        input_signal: signal,
        match: match ?? null,
        all_signals: library.crowd_signals,
        guidance: match
          ? `Diagnosis: ${match.diagnosis}. Pivot: ${match.pivot}.`
          : "No exact signal match — describe the floor in one of these phrasings, or trust your read.",
      };
    },
  },
  {
    name: "list_transition_presets",
    description: "List every transition preset with its rule-set and use case.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    schema: z.object({}).strict(),
    handler: async () => ({ presets: library.transition_presets }),
  },
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) {
    throw new Error(`Unknown tool: ${req.params.name}`);
  }
  const parsed = tool.schema.parse(req.params.arguments ?? {});
  const result = await (tool.handler as (input: unknown) => Promise<unknown>)(parsed);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("dj-gent MCP server ready on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`dj-gent fatal: ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
