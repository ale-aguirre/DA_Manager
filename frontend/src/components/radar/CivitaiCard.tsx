"use client";
import React from "react";
import { Download, Heart, Loader2, Check } from "lucide-react";
import type { CivitaiModel } from "../../types/civitai";

function formatCount(n?: number): string {
  if (!n || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 >= 100_000 ? 1 : 0)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export default function CivitaiCard({ model }: { model: CivitaiModel }) {
  const primaryImage =
    model.images?.[0] ?? model.modelVersions?.[0]?.images?.[0] ?? undefined;
  const isVideo = primaryImage?.type === "video";
  const imageUrl = primaryImage?.url ?? "/next.svg";
  const downloads = model.stats?.downloadCount ?? 0;
  const likes = model.stats?.thumbsUpCount ?? 0;
  const tags = (model.tags ?? []).slice(0, 3);

  const [downloading, setDownloading] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const resolveDownloadUrl = (): string | null => {
    const mv = model.modelVersions?.[0];
    const candidates = mv?.files || [];
    const bySafetensors = candidates.find((f) => (f?.downloadUrl || "").toLowerCase().endsWith(".safetensors"));
    const first = candidates[0];
    return bySafetensors?.downloadUrl || first?.downloadUrl || mv?.downloadUrl || null;
  };

  const onDownload = async () => {
    setError(null);
    const url = resolveDownloadUrl();
    if (!url) {
      setError("Sin URL de descarga");
      return;
    }
    const rawName = model.name?.toLowerCase().replace(/\s+/g, "_") || "lora";
    const filename = rawName.endsWith(".safetensors") ? rawName : `${rawName}.safetensors`;

    setDownloading(true);
    try {
      const res = await fetch(`${baseUrl}/download-lora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, filename }),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      console.log("LORA descargada:", data);
      setInstalled(true);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      className="group rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-xl transition-transform duration-200 hover:scale-[1.02] hover:border-slate-700"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-slate-800">
        {isVideo ? (
          <div className="flex h-full w-full items-center justify-center">
            <span className="rounded bg-black/40 px-3 py-1 text-xs text-zinc-200">
              VIDEO/GIF
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={model.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {/* Overlay badges */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[11px] text-zinc-100">
            <Download className="h-3 w-3" aria-hidden /> {formatCount(downloads)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[11px] text-zinc-100">
            <Heart className="h-3 w-3" aria-hidden /> {formatCount(likes)}
          </span>
        </div>
      </div>
      <h3 className="mt-3 truncate text-base font-semibold">{model.name}</h3>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onDownload}
          disabled={downloading || installed}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
        >
          {downloading ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : installed ? (
            <Check className="h-3 w-3 text-green-400" aria-hidden />
          ) : (
            <Download className="h-3 w-3" aria-hidden />
          )}
          {downloading ? "Descargando..." : installed ? "✅ Instalado" : "⬇️ Descargar"}
        </button>
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
    </article>
  );
}