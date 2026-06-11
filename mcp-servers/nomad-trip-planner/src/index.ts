#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { computeDaylight } from "./daylight.js";
import { selectProvider } from "./parkups.js";
import { planDayTrip, renderQuickBrief } from "./trip.js";
import { selectWeatherProvider } from "./weather.js";

const server = new Server(
  {
    name: "nomad-trip-planner",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const parkupProvider = selectProvider();
const weatherProvider = selectWeatherProvider();

function parseAnchor(): { lat: number; lng: number } | null {
  const raw = process.env.NOMAD_DEFAULT_ANCHOR;
  if (!raw) return null;
  const [lat, lng] = raw.split(",").map((x) => Number(x.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const LatLngSchema = z
  .object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  })
  .strict();

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const VibeSchema = z
  .enum(["beach", "forest", "mountain", "quiet", "scenic", "new-to-me"])
  .describe("Pick a mood for the trip.");

const tools = [
  {
    name: "plan_day_trip",
    description:
      "Plan a short nearby day trip from a home/work anchor. Returns 2-3 ranked destination candidates with drive time, weather for the day, sunset, a parkup recommendation, and Google Maps deeplinks. Good default tool — call this first.",
    inputSchema: {
      type: "object",
      properties: {
        home_or_work_location: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["lat", "lng"],
          additionalProperties: false,
          description:
            "Starting anchor — usually the driver's home base or current work spot. If omitted, falls back to NOMAD_DEFAULT_ANCHOR.",
        },
        max_drive_minutes: {
          type: "number",
          description: "Hard limit on one-way drive time, e.g. 45.",
        },
        vibe: {
          type: "string",
          enum: ["beach", "forest", "mountain", "quiet", "scenic", "new-to-me"],
        },
        date: { type: "string", description: "Trip date, YYYY-MM-DD." },
        overnight: { type: "boolean", description: "Filter to overnight-friendly parkups." },
        limit: { type: "number", description: "Number of candidates (default 3, max 5)." },
      },
      required: ["max_drive_minutes", "date"],
      additionalProperties: false,
    },
    schema: z
      .object({
        home_or_work_location: LatLngSchema.optional(),
        max_drive_minutes: z.number().int().min(5).max(240),
        vibe: VibeSchema.optional(),
        date: DateSchema,
        overnight: z.boolean().optional(),
        limit: z.number().int().min(1).max(5).optional(),
      })
      .strict(),
    handler: async (input: {
      home_or_work_location?: { lat: number; lng: number };
      max_drive_minutes: number;
      vibe?: string;
      date: string;
      overnight?: boolean;
      limit?: number;
    }) => {
      const origin = input.home_or_work_location ?? parseAnchor();
      if (!origin) {
        throw new Error(
          "No origin supplied and NOMAD_DEFAULT_ANCHOR is not set. Pass home_or_work_location={lat,lng}."
        );
      }
      return planDayTrip(
        {
          origin,
          max_drive_minutes: input.max_drive_minutes,
          vibe: input.vibe,
          date: input.date,
          overnight: input.overnight,
          limit: input.limit,
        },
        { parkups: parkupProvider, weather: weatherProvider }
      );
    },
  },
  {
    name: "find_van_parkup",
    description:
      "Find van-friendly parkups near a coordinate. Backed by a pluggable provider (fixture by default; iOverlander / Park4Night / Google Places stubs in place). Works offline on first run via the bundled sample fixture.",
    inputSchema: {
      type: "object",
      properties: {
        near_lat: { type: "number" },
        near_lng: { type: "number" },
        radius_km: { type: "number", description: "Search radius in kilometres." },
        overnight: { type: "boolean" },
        vibe: {
          type: "string",
          enum: ["beach", "forest", "mountain", "quiet", "scenic", "new-to-me"],
        },
      },
      required: ["near_lat", "near_lng", "radius_km"],
      additionalProperties: false,
    },
    schema: z
      .object({
        near_lat: z.number().gte(-90).lte(90),
        near_lng: z.number().gte(-180).lte(180),
        radius_km: z.number().positive().max(500),
        overnight: z.boolean().optional(),
        vibe: VibeSchema.optional(),
      })
      .strict(),
    handler: async (input: {
      near_lat: number;
      near_lng: number;
      radius_km: number;
      overnight?: boolean;
      vibe?: string;
    }) => {
      const parkups = await parkupProvider.findNearby({
        near: { lat: input.near_lat, lng: input.near_lng },
        radius_km: input.radius_km,
        overnight: input.overnight,
        vibe: input.vibe,
      });
      return {
        provider: parkupProvider.id,
        count: parkups.length,
        parkups,
      };
    },
  },
  {
    name: "weather_window",
    description:
      "Hourly forecast for a coordinate on a given date, plus the best 3-hour window rec. Uses Open-Meteo (free, no key) by default; falls back to a synthesised fixture when NOMAD_WEATHER_PROVIDER=fixture.",
    inputSchema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD." },
      },
      required: ["lat", "lng", "date"],
      additionalProperties: false,
    },
    schema: z
      .object({
        lat: z.number().gte(-90).lte(90),
        lng: z.number().gte(-180).lte(180),
        date: DateSchema,
      })
      .strict(),
    handler: async (input: { lat: number; lng: number; date: string }) => {
      return weatherProvider.forecast(input.lat, input.lng, input.date);
    },
  },
  {
    name: "daylight",
    description:
      "Sunrise, sunset, solar noon and golden-hour windows for a coordinate + date. Computed locally with a NOAA approximation — no API calls.",
    inputSchema: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD." },
      },
      required: ["lat", "lng", "date"],
      additionalProperties: false,
    },
    schema: z
      .object({
        lat: z.number().gte(-90).lte(90),
        lng: z.number().gte(-180).lte(180),
        date: DateSchema,
      })
      .strict(),
    handler: async (input: { lat: number; lng: number; date: string }) => {
      return computeDaylight(input.lat, input.lng, input.date);
    },
  },
  {
    name: "quick_brief",
    description:
      "One-paragraph plain-text brief for a chosen destination candidate, suitable for reading aloud via TTS while driving. Pass the result of plan_day_trip and an optional candidate_id; defaults to top pick.",
    inputSchema: {
      type: "object",
      properties: {
        plan: {
          type: "object",
          description: "The full object returned by plan_day_trip.",
        },
        candidate_id: {
          type: "string",
          description: "Parkup id to narrate. Defaults to plan.top_pick_id.",
        },
      },
      required: ["plan"],
      additionalProperties: false,
    },
    schema: z
      .object({
        plan: z.object({
          top_pick_id: z.string().nullable(),
          candidates: z.array(z.any()),
        }),
        candidate_id: z.string().optional(),
      })
      .strict(),
    handler: async (input: {
      plan: { top_pick_id: string | null; candidates: unknown[] };
      candidate_id?: string;
    }) => {
      const id = input.candidate_id ?? input.plan.top_pick_id;
      if (!id) {
        throw new Error("No candidate_id provided and plan has no top_pick_id.");
      }
      const candidate = (input.plan.candidates as { destination: { id: string } }[]).find(
        (c) => c.destination.id === id
      );
      if (!candidate) {
        throw new Error(`Candidate "${id}" not found in plan.`);
      }
      return {
        candidate_id: id,
        brief_text: renderQuickBrief(candidate as Parameters<typeof renderQuickBrief>[0]),
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
  process.stderr.write(
    `nomad-trip-planner MCP server ready on stdio (weather=${weatherProvider.id}, parkups=${parkupProvider.id})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`nomad-trip-planner fatal: ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
