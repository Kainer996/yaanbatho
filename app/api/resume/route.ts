import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, readdir, unlink, stat } from "fs/promises";
import path from "path";

/**
 * /api/resume — durable session memory for Claude Code (or any client).
 *
 * Lets you save + retrieve session memory from any device so a conversation
 * can be resumed across machines. Each session is a JSON file under
 * data/sessions/{session_id}.json on the host filesystem.
 *
 *   POST   /api/resume          → save / append to a session
 *   GET    /api/resume?id=X     → fetch a session
 *   GET    /api/resume          → list all sessions (metadata only)
 *   DELETE /api/resume?id=X     → delete a session
 *
 * Auth: token passed via `x-resume-token` header, `?token=` query param,
 * or `token` field in a JSON POST body. Set RESUME_TOKEN in your env.
 */

export const dynamic = "force-dynamic";

const SESSIONS_DIR = path.join(process.cwd(), "data", "sessions");
const RESUME_TOKEN = process.env.RESUME_TOKEN || "yaan2026";
const MAX_SESSION_BYTES = 25 * 1024 * 1024; // 25MB per session
const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

type Message = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  ts?: number;
  [k: string]: unknown;
};

type Session = {
  id: string;
  created: number;
  updated: number;
  title?: string;
  device?: string;
  context?: Record<string, unknown>;
  messages: Message[];
};

function authed(req: NextRequest, bodyToken?: string): boolean {
  const headerToken = req.headers.get("x-resume-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return (
    headerToken === RESUME_TOKEN ||
    queryToken === RESUME_TOKEN ||
    bodyToken === RESUME_TOKEN
  );
}

function sessionPath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

async function readSession(id: string): Promise<Session | null> {
  try {
    const raw = await readFile(sessionPath(id), "utf-8");
    return JSON.parse(raw) as Session;
  } catch (e: any) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

async function writeSession(s: Session): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
  const serialized = JSON.stringify(s, null, 2);
  if (Buffer.byteLength(serialized, "utf-8") > MAX_SESSION_BYTES) {
    throw new Error(`Session exceeds ${MAX_SESSION_BYTES} bytes`);
  }
  await writeFile(sessionPath(s.id), serialized, "utf-8");
}

export async function GET(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    if (!ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const session = await readSession(id);
    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  // list mode — return metadata only, not full messages
  try {
    await mkdir(SESSIONS_DIR, { recursive: true });
    const files = await readdir(SESSIONS_DIR);
    const metas = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const fp = path.join(SESSIONS_DIR, f);
          try {
            const [st, raw] = await Promise.all([stat(fp), readFile(fp, "utf-8")]);
            const s = JSON.parse(raw) as Session;
            return {
              id: s.id,
              title: s.title,
              device: s.device,
              created: s.created,
              updated: s.updated,
              messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
              bytes: st.size,
            };
          } catch {
            return null;
          }
        }),
    );
    const sessions = metas
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.updated - a.updated);
    return NextResponse.json({ sessions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!authed(req, body?.token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id: string | undefined = body?.id ?? body?.session_id;
  if (!id || !ID_RE.test(id)) {
    return NextResponse.json(
      { error: "Missing or invalid id (alphanumeric, _, -, max 128)" },
      { status: 400 },
    );
  }

  const append = body?.append !== false; // default: append
  const now = Date.now();
  const incomingMessages: Message[] = Array.isArray(body?.messages)
    ? body.messages
    : [];
  const context: Record<string, unknown> | undefined = body?.context;

  const existing = await readSession(id);
  const session: Session = existing
    ? { ...existing }
    : {
        id,
        created: now,
        updated: now,
        messages: [],
      };

  if (body?.title !== undefined) session.title = String(body.title);
  if (body?.device !== undefined) session.device = String(body.device);
  if (context !== undefined) {
    session.context = append ? { ...(session.context ?? {}), ...context } : context;
  }

  if (incomingMessages.length) {
    const stamped = incomingMessages.map((m) => ({ ts: now, ...m }));
    session.messages = append ? [...session.messages, ...stamped] : stamped;
  } else if (!append) {
    session.messages = [];
  }

  session.updated = now;

  try {
    await writeSession(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: session.id,
    updated: session.updated,
    messageCount: session.messages.length,
  });
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    await unlink(sessionPath(id));
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
