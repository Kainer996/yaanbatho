const DEFAULT_BASE = "http://localhost:3000";

export interface SunoClip {
  id: string;
  title?: string;
  status?: string;
  audio_url?: string;
  video_url?: string;
  image_url?: string;
  lyric?: string;
  metadata?: unknown;
}

function base(): string {
  return (process.env.SUNO_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Suno proxy ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as T;
}

export async function generate(params: {
  prompt: string;
  make_instrumental?: boolean;
  model?: string;
  wait_audio?: boolean;
}): Promise<SunoClip[]> {
  return request<SunoClip[]>("/api/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function customGenerate(params: {
  prompt: string;
  tags: string;
  title: string;
  make_instrumental?: boolean;
  model?: string;
  wait_audio?: boolean;
}): Promise<SunoClip[]> {
  return request<SunoClip[]>("/api/custom_generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getClips(ids: string[]): Promise<SunoClip[]> {
  const qs = ids.length ? `?ids=${encodeURIComponent(ids.join(","))}` : "";
  return request<SunoClip[]>(`/api/get${qs}`, { method: "GET" });
}
