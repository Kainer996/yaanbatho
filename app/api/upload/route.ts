import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || "yaan2026";
const MAX_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get("token") as string;

    if (token !== UPLOAD_TOKEN) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "No files" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const results = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        results.push({ name: file.name, error: "Too large (200MB max)" });
        continue;
      }

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ts = Date.now();
      const filename = `${ts}-${safe}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);
      results.push({ name: file.name, saved: filename, url: `/uploads/${filename}`, size: file.size });
    }

    return NextResponse.json({ ok: true, files: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
