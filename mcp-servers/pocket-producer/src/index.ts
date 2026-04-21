#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  buildSunoPromptSeeds,
  findProducer,
  loadLibrary,
  renderStyleBrief,
} from "./knowledge.js";
import { customGenerate, generate, getClips } from "./suno.js";

const server = new Server(
  {
    name: "pocket-producer",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const library = loadLibrary();

const StyleId = z.string().describe("Producer style id, e.g. 'kainer' or 'il-diablo'. Omit to use the default.");

const tools = [
  {
    name: "list_reference_tracks",
    description:
      "List the full reference library — producers, their signature style, and their own tracks. Use this to understand the sonic vocabulary before generating or critiquing.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    schema: z.object({}).strict(),
    handler: async () => {
      return {
        producers: library.producers.map((p) => ({
          id: p.id,
          name: p.name,
          bio: p.bio,
          signature_style: p.signature_style,
          tracks: p.tracks,
        })),
      };
    },
  },
  {
    name: "get_producer_style_brief",
    description:
      "Return a markdown brief capturing a producer's signature style. Feed this into an LLM as context before it writes lyrics, prompts, or critique.",
    inputSchema: {
      type: "object",
      properties: { style: { type: "string" } },
      additionalProperties: false,
    },
    schema: z.object({ style: StyleId.optional() }).strict(),
    handler: async ({ style }: { style?: string }) => {
      const producer = findProducer(library, style);
      return { producer_id: producer.id, brief_markdown: renderStyleBrief(producer) };
    },
  },
  {
    name: "generate_track",
    description:
      "Generate a track via the self-hosted Suno proxy. If `custom` is true, uses the custom-mode endpoint with explicit tags and title; otherwise uses the simple prompt endpoint. Style defaults to Kainer.",
    inputSchema: {
      type: "object",
      properties: {
        brief: { type: "string", description: "Short creative brief for the track (mood, vibe, idea)." },
        style: { type: "string", description: "Producer style id." },
        custom: { type: "boolean", description: "Use custom_generate with tags + title." },
        title: { type: "string" },
        instrumental: { type: "boolean" },
        wait_audio: { type: "boolean", description: "Block until audio URL is ready (slower)." },
        model: { type: "string", description: "Suno model name, e.g. 'chirp-v3-5'." },
      },
      required: ["brief"],
      additionalProperties: false,
    },
    schema: z
      .object({
        brief: z.string().min(1),
        style: StyleId.optional(),
        custom: z.boolean().optional(),
        title: z.string().optional(),
        instrumental: z.boolean().optional(),
        wait_audio: z.boolean().optional(),
        model: z.string().optional(),
      })
      .strict(),
    handler: async (args: {
      brief: string;
      style?: string;
      custom?: boolean;
      title?: string;
      instrumental?: boolean;
      wait_audio?: boolean;
      model?: string;
    }) => {
      const producer = findProducer(library, args.style);
      const seeds = buildSunoPromptSeeds(producer, args.brief);
      const clips = args.custom
        ? await customGenerate({
            prompt: args.brief,
            tags: producer.signature_style.genres.join(", "),
            title: args.title ?? `${producer.name} — ${args.brief.slice(0, 32)}`,
            make_instrumental: args.instrumental,
            wait_audio: args.wait_audio,
            model: args.model,
          })
        : await generate({
            prompt: seeds.style_prompt,
            make_instrumental: args.instrumental,
            wait_audio: args.wait_audio,
            model: args.model,
          });
      return {
        producer: producer.id,
        seeds,
        clips: clips.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          audio_url: c.audio_url,
          video_url: c.video_url,
          image_url: c.image_url,
        })),
      };
    },
  },
  {
    name: "get_generation_status",
    description:
      "Poll the Suno proxy for one or more previously-generated clip ids. Returns current status and audio URLs when ready.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" } },
      },
      required: ["ids"],
      additionalProperties: false,
    },
    schema: z.object({ ids: z.array(z.string()).min(1) }).strict(),
    handler: async ({ ids }: { ids: string[] }) => {
      const clips = await getClips(ids);
      return { clips };
    },
  },
  {
    name: "critique_mix",
    description:
      "Critique a mix against the producer's own mix fingerprint. Pass a text description of what you hear (or a transcript/analysis of the track). Returns a structured critique prompt an LLM can use plus the reference checklist.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "What you hear in the mix — frequencies, dynamics, space, groove." },
        style: { type: "string" },
      },
      required: ["description"],
      additionalProperties: false,
    },
    schema: z
      .object({
        description: z.string().min(1),
        style: StyleId.optional(),
      })
      .strict(),
    handler: async ({ description, style }: { description: string; style?: string }) => {
      const producer = findProducer(library, style);
      return {
        producer: producer.id,
        checklist: library.mix_critique_checklist,
        fingerprint: producer.signature_style.mix_fingerprint,
        critique_prompt: [
          `You are ${producer.name}'s mix engineer. Critique this mix against ${producer.name}'s fingerprint.`,
          "",
          "### Fingerprint",
          ...producer.signature_style.mix_fingerprint.map((x) => `- ${x}`),
          "",
          "### Checklist",
          ...library.mix_critique_checklist.map((x) => `- ${x}`),
          "",
          "### Mix under review",
          description,
          "",
          "Give feedback in three buckets: what works, what breaks the fingerprint, specific next moves (with target frequencies / dB values where useful). Be direct, no fluff.",
        ].join("\n"),
      };
    },
  },
  {
    name: "suggest_chord_progression",
    description:
      "Suggest chord progressions tailored to a mood and producer style. Returns Roman-numeral progressions plus a recommended key from the producer's palette.",
    inputSchema: {
      type: "object",
      properties: {
        mood: {
          type: "string",
          description: "Target mood bucket: 'melodic_techno_minor' | 'tech_house_groove' | 'deep_emotional'.",
        },
        style: { type: "string" },
      },
      required: ["mood"],
      additionalProperties: false,
    },
    schema: z
      .object({
        mood: z.string().min(1),
        style: StyleId.optional(),
      })
      .strict(),
    handler: async ({ mood, style }: { mood: string; style?: string }) => {
      const producer = findProducer(library, style);
      const progressions =
        library.chord_progression_presets[mood] ??
        library.chord_progression_presets.melodic_techno_minor;
      const key = producer.signature_style.common_keys[0] ?? "A minor";
      const bpm = Math.round(
        (producer.signature_style.bpm_range[0] + producer.signature_style.bpm_range[1]) / 2,
      );
      return {
        producer: producer.id,
        mood,
        key,
        bpm,
        progressions,
        note: "Each array is one 4-chord loop in Roman numerals. Lowercase = minor, uppercase = major. Loop for 8 or 16 bars.",
      };
    },
  },
  {
    name: "arrangement_feedback",
    description:
      "Compare a candidate arrangement to the producer's typical structure. Pass the phases of your track; get phase-by-phase feedback prompts anchored to the reference arrangement.",
    inputSchema: {
      type: "object",
      properties: {
        current_arrangement: {
          type: "string",
          description: "Describe the current arrangement by phase — e.g. 'bars 1-16 drums only, bar 17 bass + pad, breakdown at 65, drop at 97...'",
        },
        style: { type: "string" },
      },
      required: ["current_arrangement"],
      additionalProperties: false,
    },
    schema: z
      .object({
        current_arrangement: z.string().min(1),
        style: StyleId.optional(),
      })
      .strict(),
    handler: async ({
      current_arrangement,
      style,
    }: {
      current_arrangement: string;
      style?: string;
    }) => {
      const producer = findProducer(library, style);
      return {
        producer: producer.id,
        reference_arrangement: producer.signature_style.arrangement_patterns,
        reference_phases: library.arrangement_phases,
        feedback_prompt: [
          `You are ${producer.name}. Compare the candidate arrangement below against your typical structure and give phase-by-phase feedback.`,
          "",
          "### Your typical arrangement",
          ...producer.signature_style.arrangement_patterns.map((x) => `- ${x}`),
          "",
          "### Candidate arrangement",
          current_arrangement,
          "",
          "For each phase say: tension curve (under/right/over), element count (under/right/over), one concrete move to bring it closer to your signature. Keep it under 250 words.",
        ].join("\n"),
      };
    },
  },
  {
    name: "match_reference_style",
    description:
      "Given a target vibe description, pick the closest tracks from the reference library and explain why. Useful when the caller wants to say 'make something like X' and needs a concrete reference.",
    inputSchema: {
      type: "object",
      properties: {
        vibe: { type: "string" },
        style: { type: "string" },
      },
      required: ["vibe"],
      additionalProperties: false,
    },
    schema: z
      .object({
        vibe: z.string().min(1),
        style: StyleId.optional(),
      })
      .strict(),
    handler: async ({ vibe, style }: { vibe: string; style?: string }) => {
      const producer = findProducer(library, style);
      return {
        producer: producer.id,
        vibe,
        candidates: producer.tracks,
        matching_prompt: [
          `You are ${producer.name}. Pick the 2-3 tracks from your own catalogue that best match this target vibe, and say in one sentence each why.`,
          "",
          "### Target vibe",
          vibe,
          "",
          "### Your catalogue",
          ...producer.tracks.map((t) => `- ${t.title}${t.notes ? ` — ${t.notes}` : ""}`),
        ].join("\n"),
      };
    },
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
  process.stderr.write("pocket-producer MCP server ready on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`pocket-producer fatal: ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
