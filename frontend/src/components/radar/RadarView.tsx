"use client";
import React from "react";
import { Scan, Loader2 } from "lucide-react";
import type { CivitaiModel } from "../../types/civitai";

export interface RadarViewProps {
  items: CivitaiModel[];
  loading: boolean;
  error: string | null;
  onScan: () => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-slate-800 animate-pulse" />
      <div className="mt-3 h-4 w-3/4 rounded bg-slate-800 animate-pulse" />
      <div className="mt-2 flex gap-2">
        <span className="h-5 w-14 rounded bg-slate-800 animate-pulse" />
        <span className="h-5 w-12 rounded bg-slate-800 animate-pulse" />
        <span className="h-5 w-16 rounded bg-slate-800 animate-pulse" />
      </div>
    </div>
  );
}

export default function RadarView({ items, loading, error, onScan }: RadarViewProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Card Escáner */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
        <h2 className="text-lg font-semibold bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">
          Escáner de Mercado
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Consulta tendencias (LORA) en Civitai por semana y rating.
        </p>
        <button
          onClick={onScan}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Scan className="h-4 w-4" aria-hidden />
          )}
          {loading ? "Escaneando..." : "Escanear Tendencias"}
        </button>
        {error && (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Resultados */}
      <div className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, idx) => <SkeletonCard key={idx} />)
            : items.map((item) => {
                const imageUrl =
                  item.modelVersions?.[0]?.images?.[0]?.url ?? "/next.svg";
                const tags = (item.tags ?? []).slice(0, 3);
                return (
                  <article
                    key={item.id}
                    className="group rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-xl transition-transform duration-200 hover:scale-[1.02] hover:border-slate-700"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <h3 className="mt-3 truncate text-base font-semibold">
                      {item.name}
                    </h3>
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
              })}
        </div>
      </div>
    </div>
  );
}