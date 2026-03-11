"use client";
import { useState, useRef } from "react";

export default function UploadPage() {
  const [token, setToken] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!token || !files.length) return;
    setUploading(true);
    setError("");
    setResults([]);

    const formData = new FormData();
    formData.append("token", token);
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else {
        setResults(data.files);
        setFiles([]);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const totalSize = files.reduce((a, f) => a + f.size, 0);
  const formatSize = (b: number) =>
    b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">📁 Upload to Yaan&apos;s Site</h1>
          <p className="text-zinc-400 text-sm mt-1">Videos, images, whatever you need</p>
        </div>

        <div className="space-y-4 bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Password</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter upload password"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Files</label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="video/*,image/*"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:font-medium file:cursor-pointer hover:file:bg-teal-500"
            />
            {files.length > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                {files.length} file{files.length > 1 ? "s" : ""} · {formatSize(totalSize)}
              </p>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !token || !files.length}
            className="w-full py-2.5 rounded-lg font-medium text-sm bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300">
            ❌ {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-green-300">✅ Uploaded!</p>
            {results.map((r, i) => (
              <div key={i} className="text-xs text-green-400">
                {r.name} → {r.url ? <a href={r.url} className="underline" target="_blank">{r.url}</a> : r.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
