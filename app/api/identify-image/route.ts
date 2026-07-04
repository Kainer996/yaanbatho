import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Species = {
  species_id: string;
  common_name: string;
  latin_name: string;
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

  const image = form.get("image") as File | null;
  const speciesJson = form.get("species") as string | null;
  const nearbyJson = (form.get("nearby") as string | null) || "[]";
  const region = (form.get("region") as string | null) || "";

  if (!image || !speciesJson) {
    return NextResponse.json(
      { error: "image and species (JSON list) are required" },
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
  const buf = Buffer.from(await image.arrayBuffer());
  const b64 = buf.toString("base64");
  const mediaType = image.type || "image/jpeg";

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
    ? `Birds tagged [SEEN NEARBY] have been observed in the user's location recently. If the photo is ambiguous, bias toward these local species.`
    : `No nearby species data is available; pick the most visually plausible match.`;

  const prompt = `You are identifying a bird from a photograph taken in the field.

Look carefully at the bird's size, shape, plumage colour and pattern, bill shape, leg colour, and any visible field marks. Match it to the single best species from the list below.

Available species (you MUST return one species_id from this list):
${speciesList}

${nearbyHint}
${region ? `User region: ${region}` : ""}

Respond with ONLY a single JSON object, no markdown, no prose around it:
{"species_id": "<one of the species_ids above>", "confidence": <number between 0 and 1>, "reasoning": "<one short sentence describing the key field marks you see>"}

Confidence guidance:
- 0.85+ : a clear, well-lit bird with diagnostic field marks you can match confidently
- 0.5-0.85 : the bird is visible but the view is partial, distant or ambiguous
- below 0.5 : no clear bird in frame, or too blurred/dark to identify; pick the most likely nearby species but signal low confidence so the player knows to retry`;

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
        model: "claude-sonnet-5",
        max_tokens: 400,
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
