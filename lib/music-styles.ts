export type StyleId = "kainer" | "il-diablo" | "generic";

export interface StylePreset {
  id: StyleId;
  name: string;
  tagline: string;
  defaultBpm: number;
  bpmRange: [number, number];
  defaultKey: string;
  promptPrefix: string;
}

export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  kainer: {
    id: "kainer",
    name: "Kainer",
    tagline: "Melodic techno · 122-134 bpm",
    defaultBpm: 128,
    bpmRange: [122, 134],
    defaultKey: "A minor",
    promptPrefix:
      "melodic techno, deep and hypnotic, hardware-driven groove, analog bass, detuned poly pads, shuffled hi-hats, granular vocal textures, FM bell counter-melody, tape-saturated drums, 128 bpm, A minor",
  },
  "il-diablo": {
    id: "il-diablo",
    name: "Il Diablo",
    tagline: "Tech house / tribal · 126-132 bpm",
    defaultBpm: 130,
    bpmRange: [126, 132],
    defaultKey: "F minor",
    promptPrefix:
      "tech house, peak-time tribal, percussive bongos and congas, tight 909 kick, chopped vocal stabs, sparse acid 303, resonant filter sweeps, dry layered claps, 130 bpm, F minor",
  },
  generic: {
    id: "generic",
    name: "Just wing it",
    tagline: "No style preset — your prompt only",
    defaultBpm: 120,
    bpmRange: [80, 160],
    defaultKey: "any",
    promptPrefix: "",
  },
};

export function buildPrompt(styleId: StyleId, userBrief: string): string {
  const preset = STYLE_PRESETS[styleId];
  const cleanBrief = userBrief.trim();
  if (!preset.promptPrefix) return cleanBrief;
  if (!cleanBrief) return preset.promptPrefix;
  return `${preset.promptPrefix}. ${cleanBrief}`;
}

export function isStyleId(value: unknown): value is StyleId {
  return value === "kainer" || value === "il-diablo" || value === "generic";
}
