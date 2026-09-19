import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { buildPrompt, isStyleId, STYLE_PRESETS } from "@/lib/music-styles";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "meta/musicgen";

interface RequestBody {
  brief?: string;
  style?: string;
  duration?: number;
}

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "Server is missing REPLICATE_API_TOKEN. The site owner needs to set it." },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brief = (body.brief ?? "").toString().trim();
  if (!brief || brief.length > 500) {
    return NextResponse.json(
      { error: "Brief is required and must be under 500 characters." },
      { status: 400 },
    );
  }

  const styleRaw = body.style ?? "generic";
  if (!isStyleId(styleRaw)) {
    return NextResponse.json({ error: "Unknown style preset." }, { status: 400 });
  }

  const duration = Math.max(5, Math.min(30, Math.round(Number(body.duration) || 10)));

  const prompt = buildPrompt(styleRaw, brief);
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    const output = await replicate.run(MODEL, {
      input: {
        prompt,
        duration,
        model_version: "stereo-large",
        output_format: "mp3",
        normalization_strategy: "loudness",
      },
    });

    const audioUrl = pickUrl(output);
    if (!audioUrl) {
      return NextResponse.json(
        { error: "Generator returned no audio. Try a different brief." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      audio_url: audioUrl,
      prompt_used: prompt,
      style: STYLE_PRESETS[styleRaw],
      duration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Generator failed: ${message}` },
      { status: 502 },
    );
  }
}

function pickUrl(output: unknown): string | null {
  if (output == null) return null;
  if (typeof output === "string") {
    return output.startsWith("http") ? output : null;
  }
  if (Array.isArray(output)) {
    for (const item of output) {
      const u = pickUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.url === "function") {
      try {
        const result = (obj.url as () => unknown)();
        if (typeof result === "string") return result;
        if (result instanceof URL) return result.toString();
      } catch {
        // fall through
      }
    }
    const s = String(output);
    if (s.startsWith("http")) return s;
  }
  return null;
}
