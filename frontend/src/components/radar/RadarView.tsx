"use client";
import React from "react";
import { Scan, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import CivitaiCard from "./CivitaiCard";
import type { CivitaiModel } from "../../types/civitai";

export interface RadarViewProps {
  items: CivitaiModel[];
  loading: boolean;
  error: string | null;
  onScan: (opts: { page?: number; period?: "Day" | "Week" | "Month" | "Year" | "AllTime"; sort?: "Highest Rated" | "Most Downloaded" | "Newest" }) => void;
}

const LS_PERIOD_KEY = "lady_radar_period";
const LS_SORT_KEY = "lady_radar_sort";

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
  const [tab, setTab] = React.useState<"Todo" | "Personaje" | "Poses" | "Estilo">("Todo");
  const [page, setPage] = React.useState<number>(1);
  const [period, setPeriod] = React.useState<"Day" | "Week" | "Month" | "Year" | "AllTime">("Week");
  const [sort, setSort] = React.useState<"Highest Rated" | "Most Downloaded" | "Newest">("Highest Rated");

  // Cargar persistencia al montar (por defecto: Day / Most Downloaded)
  React.useEffect(() => {
    try {
      const p = (localStorage.getItem(LS_PERIOD_KEY) as any) || "Day";
      const s = (localStorage.getItem(LS_SORT_KEY) as any) || "Most Downloaded";
      setPeriod(p);
      setSort(s);
    } catch (_) {}
  }, []);

  const filtered = React.useMemo(() => {
    if (tab === "Todo") return items;
    const matchers: Record<string, (tags?: string[]) => boolean> = {
      "Personaje": (tags) => (tags || []).some((t) => t.toLowerCase().includes("character")),
      "Poses": (tags) => (tags || []).some((t) => {
        const s = t.toLowerCase();
        return s.includes("pose") || s.includes("standing") || s.includes("sitting") || s.includes("action");
      }),
      "Estilo": (tags) => (tags || []).some((t) => t.toLowerCase().includes("style")),
    };
    return items.filter((m) => matchers[tab](m.tags));
  }, [items, tab]);

  const triggerScan = (p: number) => {
    setPage(p);
    onScan({ page: p, period, sort });
  };

  // Auto buscar y persistir al cambiar periodo/orden
  React.useEffect(() => {
    try {
      localStorage.setItem(LS_PERIOD_KEY, period);
      localStorage.setItem(LS_SORT_KEY, sort);
    } catch (_) {}
    onScan({ page: 1, period, sort });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, sort]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Card Escáner */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
        <h2 className="text-lg font-semibold bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">
          Escáner de Mercado
        </h2>
        <p className="mt-1 text-sm text-zinc-400">Consulta tendencias (LORA) en Civitai.</p>

        {/* Barra de herramientas */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400">Periodo</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
            >
              <option value="Day">Día</option>
              <option value="Week">Semana</option>
              <option value="Month">Mes</option>
              <option value="Year">Año</option>
              <option value="AllTime">Todo</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400">Ordenar por</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
            >
              <option value="Highest Rated">Valoración</option>
              <option value="Most Downloaded">Descargas</option>
              <option value="Newest">Novedades</option>
            </select>
          </label>
        </div>

        {/* Acciones */}
        <button
          onClick={() => triggerScan(1)}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Scan className="h-4 w-4" aria-hidden />
          )}
          {loading ? "Escaneando..." : "Escanear Tendencias"}
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>

      {/* Resultados */}
      <div className="lg:col-span-2">
        {/* Tabs de categoría */}
        <div className="mb-4 flex flex-wrap gap-2">
          {["Todo", "Personaje", "Poses", "Estilo"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs cursor-pointer transition-all active:scale-95 ${
                tab === t
                  ? "border-violet-500 bg-violet-500/20 text-violet-200"
                  : "border-slate-800 bg-slate-900 text-zinc-300 hover:bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, idx) => <SkeletonCard key={idx} />)
            : filtered.map((item, idx) => <CivitaiCard key={item.id} model={item} index={idx + 1} />)}
        </div>
        {/* Paginación */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={() => triggerScan(Math.max(1, page - 1))}
            disabled={loading || page <= 1}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-xs text-zinc-400">Página {page}</span>
          <button
            onClick={() => triggerScan(page + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}