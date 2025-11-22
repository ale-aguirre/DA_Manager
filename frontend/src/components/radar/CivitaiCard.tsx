"use client";
import React from "react";
import { Download, Heart } from "lucide-react";
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
    </article>
  );
}