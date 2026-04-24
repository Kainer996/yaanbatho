import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const defaultLibraryPath = resolve(here, "..", "dj-knowledge.json");

export interface Persona {
  id: string;
  name: string;
  bio: string;
  set_style: {
    genres: string[];
    bpm_range: [number, number];
    preferred_keys_camelot: string[];
    transition_styles: string[];
    energy_arc: string;
    track_length_minutes: [number, number];
    vocals: string;
    do: string[];
    dont: string[];
  };
}

export interface CamelotKey {
  camelot: string;
  key: string;
  openkey: string;
}

export interface SlotPhase {
  name: string;
  minutes: number;
  energy: string;
  bpm_drift: string;
  notes: string;
}

export interface SlotTemplate {
  id: string;
  name: string;
  phases: SlotPhase[];
}

export interface TransitionPreset {
  id: string;
  name: string;
  best_for: string;
  duration_bars: number;
  bpm_tolerance: number;
  key_rule: string;
  moves: string[];
}

export interface CrowdSignal {
  signal: string;
  diagnosis: string;
  pivot: string;
}

export interface CuePointTemplate {
  description: string;
  cues: { label: string; purpose: string }[];
}

export interface Library {
  personas: Persona[];
  camelot_wheel: { description: string; keys: CamelotKey[] };
  slot_templates: SlotTemplate[];
  transition_presets: TransitionPreset[];
  cue_point_template: CuePointTemplate;
  crowd_signals: CrowdSignal[];
}

export function loadLibrary(path?: string): Library {
  const target = path ?? process.env.DJ_GENT_LIBRARY ?? defaultLibraryPath;
  const raw = readFileSync(target, "utf8");
  return JSON.parse(raw) as Library;
}

export function findPersona(lib: Library, id?: string): Persona {
  const fallback = process.env.DJ_GENT_DEFAULT_PERSONA;
  const wanted = (id ?? fallback ?? lib.personas[0]?.id ?? "").toLowerCase();
  const match = lib.personas.find((p) => p.id.toLowerCase() === wanted);
  if (!match) {
    throw new Error(
      `Unknown persona "${wanted}". Available: ${lib.personas.map((p) => p.id).join(", ")}`,
    );
  }
  return match;
}

export function renderPersonaBrief(persona: Persona): string {
  const s = persona.set_style;
  return [
    `# DJ Persona: ${persona.name}`,
    persona.bio,
    "",
    `**Genres:** ${s.genres.join(", ")}`,
    `**BPM range:** ${s.bpm_range[0]}-${s.bpm_range[1]}`,
    `**Preferred Camelot keys:** ${s.preferred_keys_camelot.join(", ")}`,
    `**Track lengths:** ${s.track_length_minutes[0]}-${s.track_length_minutes[1]} minutes`,
    `**Vocals:** ${s.vocals}`,
    "",
    `**Energy arc:** ${s.energy_arc}`,
    "",
    "**Transition styles:**",
    ...s.transition_styles.map((x) => `- ${x}`),
    "",
    "**Do:**",
    ...s.do.map((x) => `- ${x}`),
    "",
    "**Don't:**",
    ...s.dont.map((x) => `- ${x}`),
  ].join("\n");
}

const camelotPattern = /^([1-9]|1[0-2])([AB])$/i;

export function normalizeCamelot(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (!camelotPattern.test(trimmed)) {
    throw new Error(`Invalid Camelot key "${input}". Expected like "8A" or "11B".`);
  }
  return trimmed;
}

function parseCamelot(camelot: string): { number: number; letter: "A" | "B" } {
  const normalized = normalizeCamelot(camelot);
  const match = camelotPattern.exec(normalized);
  if (!match) {
    throw new Error(`Invalid Camelot key "${camelot}".`);
  }
  return { number: Number(match[1]), letter: match[2] as "A" | "B" };
}

export function camelotNeighbours(camelot: string): {
  perfect_match: string;
  energy_boost: string;
  energy_drop: string;
  relative: string;
  fifth_up: string;
  fifth_down: string;
  diagonal: string[];
} {
  const { number, letter } = parseCamelot(camelot);
  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
  const flip = (l: "A" | "B"): "A" | "B" => (l === "A" ? "B" : "A");
  const sameLetter = (n: number) => `${n}${letter}`;
  const otherLetter = (n: number) => `${n}${flip(letter)}`;
  return {
    perfect_match: `${number}${letter}`,
    energy_boost: `${number}${flip(letter)}`,
    energy_drop: `${number}${flip(letter)}`,
    relative: `${number}${flip(letter)}`,
    fifth_up: sameLetter(wrap(number + 1)),
    fifth_down: sameLetter(wrap(number - 1)),
    diagonal: [otherLetter(wrap(number + 1)), otherLetter(wrap(number - 1))],
  };
}

export function compatibleCamelot(camelot: string): {
  input: string;
  same: string;
  fifth_up: string;
  fifth_down: string;
  energy_switch: string;
  bold: string[];
  rules: string[];
} {
  const { number, letter } = parseCamelot(camelot);
  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
  const flip = (l: "A" | "B"): "A" | "B" => (l === "A" ? "B" : "A");
  return {
    input: `${number}${letter}`,
    same: `${number}${letter}`,
    fifth_up: `${wrap(number + 1)}${letter}`,
    fifth_down: `${wrap(number - 1)}${letter}`,
    energy_switch: `${number}${flip(letter)}`,
    bold: [
      `${wrap(number + 7)}${letter}`,
      `${wrap(number + 2)}${flip(letter)}`,
      `${wrap(number - 2)}${flip(letter)}`,
    ],
    rules: [
      "Safe: same number, same letter (perfect match)",
      "Safe: +/- 1 number, same letter (fifth up / down)",
      "Energy switch: same number, flip letter (relative major/minor)",
      "Bold: +7 same letter (mood swing), +/- 2 flip letter (diagonal)",
      "Risky above this — only attempt with EQ kills or breakdown bridges",
    ],
  };
}

export interface ProvidedTrack {
  title: string;
  artist?: string;
  bpm?: number;
  camelot?: string;
  energy?: number;
  duration_seconds?: number;
  notes?: string;
}

export function bpmCompatibility(a: number, b: number): {
  delta: number;
  pitch_percent: number;
  verdict: "lock" | "safe" | "stretch" | "no";
} {
  const delta = Math.abs(a - b);
  const pitch_percent = Math.round(((b - a) / a) * 1000) / 10;
  let verdict: "lock" | "safe" | "stretch" | "no" = "no";
  if (delta < 0.5) verdict = "lock";
  else if (delta <= 2) verdict = "safe";
  else if (delta <= 5) verdict = "stretch";
  return { delta: Math.round(delta * 10) / 10, pitch_percent, verdict };
}
