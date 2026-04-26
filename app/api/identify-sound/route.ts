import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Species = {
  species_id: string;
  common_name: string;
  latin_name: string;
  element?: string;
  biome?: string[];
  rarity_tier?: string;
};

type ClaudeResponse = {
  species_id: string;
  confidence: number;
  reasoning?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on the server" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const spectrogram = form.get("spectrogram") as File | null;
  const speciesJson = form.get("species") as string | null;
  const nearbyJson = (form.get("nearby") as string | null) || "[]";
  const region = (form.get("region") as string | null) || "";
  const recordedAt = (form.get("recorded_at") as string | null) || "";

  if (!spectrogram || !speciesJson) {
    return NextResponse.json(
      { error: "spectrogram (image) and species (JSON list) are required" },
      { status: 400 }
    );
  }

  let species: Species[] = [];
  let nearby: string[] = [];
  try {
    species = JSON.parse(speciesJson);
    nearby = JSON.parse(nearbyJson);
  } catch (e: any) {
    return NextResponse.json({ error: "species/nearby must be valid JSON" }, { status: 400 });
  }
  if (!Array.isArray(species) || species.length === 0) {
    return NextResponse.json({ error: "species list must be non-empty" }, { status: 400 });
  }

  const allowedIds = new Set(species.map((s) => s.species_id));
  const buf = Buffer.from(await spectrogram.arrayBuffer());
  const b64 = buf.toString("base64");
  const mediaType = spectrogram.type || "image/png";

  const speciesList = species
    .map((s) => {
      const tags: string[] = [];
      if (nearby.includes(s.species_id)) tags.push("SEEN NEARBY");
      if (s.biome && s.biome.length) tags.push(s.biome.join("/"));
      const tail = tags.length ? `  [${tags.join(" · ")}]` : "";
      return `- ${s.species_id}: ${s.common_name} (${s.latin_name})${tail}`;
    })
    .join("\n");

  const nearbyHint = nearby.length > 0
    ? `Birds tagged [SEEN NEARBY] have been observed in the user's location within the last 14 days. Strongly bias toward these — most sounds in the field will be from a recently-observed local species.`
    : `No nearby species data is available; pick the most acoustically plausible match.`;

  const prompt = `You are identifying a bird from a spectrogram of a recording.

The image is a log-frequency spectrogram (low frequencies at the bottom, high at the top, brighter pixels = louder energy at that frequency / time). Bird vocalisations have characteristic patterns:
- Robins, Wrens, Goldfinches: complex tonal warbles, often spanning 3-7 kHz, with rapid frequency modulation
- Tits (Blue/Great): high, thin whistles around 4-7 kHz, often two- or three-note phrases
- Corvids (Crow/Raven/Magpie/Jay): broadband caws/croaks with strong energy under 2 kHz, harsh and noisy
- Owls: low hoots well under 1 kHz
- Raptors (Peregrine/Sparrowhawk/Eagle): sharp shrill cries 1-3 kHz
- Woodpeckers: rapid drumming bursts, broadband
- Aquatic (Heron/Mallard/Puffin/Kingfisher): low harsh calls or sharp whistles by water
- Skylark, Swift, Song Thrush: long sustained complex song
- Background noise / wind / silence: no clear structured patterns

Available species (you MUST return one species_id from this list):
${speciesList}

${nearbyHint}
${region ? `User region: ${region}` : ""}
${recordedAt ? `Recorded at: ${recordedAt}` : ""}

Respond with ONLY a single JSON object, no markdown, no prose around it:
{"species_id": "<one of the species_ids above>", "confidence": <number between 0 and 1>, "reasoning": "<one short sentence describing what you see in the spectrogram>"}

Confidence guidance:
- 0.85+ : a clear, structured bird call you can match with high certainty
- 0.5-0.85 : plausible match but ambiguous (multiple birds could fit)
- below 0.5 : the spectrogram shows mostly noise / wind / silence / nothing identifiable; pick the most likely nearby species but signal low confidence so the player knows to retry`;

  let claudeResp: Response;
  try {
    claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: b64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to reach Anthropic API", detail: e.message }, { status: 502 });
  }

  if (!claudeResp.ok) {
    const errText = await claudeResp.text().catch(() => "(no body)");
    return NextResponse.json(
      { error: "Anthropic API returned " + claudeResp.status, detail: errText },
      { status: 502 }
    );
  }

  const data = (await claudeResp.json()) as any;
  const text = (data?.content?.[0]?.text || "").trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "Could not parse Claude response", raw: text },
      { status: 502 }
    );
  }

  let parsed: ClaudeResponse;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Claude returned invalid JSON", raw: jsonMatch[0] },
      { status: 502 }
    );
  }

  if (!parsed.species_id || !allowedIds.has(parsed.species_id)) {
    return NextResponse.json(
      { error: "Claude returned a species_id not in the allowed list", returned: parsed.species_id },
      { status: 502 }
    );
  }

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  return NextResponse.json({
    species_id: parsed.species_id,
    confidence,
    reasoning: parsed.reasoning || "",
  });
}
