import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const defaultLibraryPath = resolve(here, "..", "reference-tracks.json");

export interface Track {
  id: string;
  title: string;
  file: string;
  artwork?: string;
  notes?: string;
}

export interface Producer {
  id: string;
  name: string;
  bio: string;
  signature_style: {
    genres: string[];
    bpm_range: [number, number];
    common_keys: string[];
    sound_palette: string[];
    mix_fingerprint: string[];
    arrangement_patterns: string[];
    references_outside_catalogue: string[];
  };
  tracks: Track[];
}

export interface Library {
  producers: Producer[];
  chord_progression_presets: Record<string, string[][]>;
  mix_critique_checklist: string[];
  arrangement_phases: { name: string; bars: string; elements: string }[];
}

export function loadLibrary(path?: string): Library {
  const target = path ?? process.env.POCKET_PRODUCER_LIBRARY ?? defaultLibraryPath;
  const raw = readFileSync(target, "utf8");
  return JSON.parse(raw) as Library;
}

export function findProducer(lib: Library, id?: string): Producer {
  const fallback = process.env.POCKET_PRODUCER_DEFAULT_STYLE;
  const wanted = (id ?? fallback ?? lib.producers[0]?.id ?? "").toLowerCase();
  const match = lib.producers.find((p) => p.id.toLowerCase() === wanted);
  if (!match) {
    throw new Error(
      `Unknown producer style "${wanted}". Available: ${lib.producers.map((p) => p.id).join(", ")}`,
    );
  }
  return match;
}

export function renderStyleBrief(producer: Producer): string {
  const s = producer.signature_style;
  return [
    `# Producer: ${producer.name}`,
    producer.bio,
    "",
    `**Genres:** ${s.genres.join(", ")}`,
    `**BPM range:** ${s.bpm_range[0]}-${s.bpm_range[1]}`,
    `**Common keys:** ${s.common_keys.join(", ")}`,
    "",
    "**Sound palette:**",
    ...s.sound_palette.map((x) => `- ${x}`),
    "",
    "**Mix fingerprint:**",
    ...s.mix_fingerprint.map((x) => `- ${x}`),
    "",
    "**Arrangement tendencies:**",
    ...s.arrangement_patterns.map((x) => `- ${x}`),
    "",
    "**Outside references (for mood, not imitation):**",
    ...s.references_outside_catalogue.map((x) => `- ${x}`),
    "",
    "**Own catalogue (primary training signal):**",
    ...producer.tracks.map((t) => `- ${t.title}${t.notes ? ` — ${t.notes}` : ""}`),
  ].join("\n");
}

export function buildSunoPromptSeeds(producer: Producer, brief: string): {
  style_prompt: string;
  title_suggestions: string[];
  recommended_bpm: number;
  recommended_key: string;
} {
  const s = producer.signature_style;
  const bpm = Math.round((s.bpm_range[0] + s.bpm_range[1]) / 2);
  const key = s.common_keys[0] ?? "A minor";
  const palette = s.sound_palette.slice(0, 4).join(", ");
  const genre = s.genres[0];
  return {
    style_prompt: `${genre}, ${bpm} bpm, ${key}, ${palette}. Produced in the style of ${producer.name}. Brief: ${brief}`,
    title_suggestions: producer.tracks.slice(0, 3).map((t) => `${t.title} (reference)`),
    recommended_bpm: bpm,
    recommended_key: key,
  };
}
