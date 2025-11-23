"use client";
import React from "react";
import { Scan, Loader2, Send, Trash2, ListX, X, Save } from "lucide-react";
import CivitaiCard from "./CivitaiCard";
import type { CivitaiModel } from "../../types/civitai";
import { postPlannerDraft } from "../../lib/api";
import { useRouter } from "next/navigation";

export interface RadarViewProps {
  items: CivitaiModel[];
  loading: boolean;
  error: string | null;
  onScan: (period: "Day" | "Week" | "Month", sort: "Rating" | "Downloads") => void;
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
  const [tab, setTab] = React.useState<"Todo" | "Personajes" | "Poses/Ropa" | "Estilo" | "Conceptos/Otros">("Personajes");
  type SelectedItem = { modelId: number; downloadUrl?: string };
  const [selectedItems, setSelectedItems] = React.useState<SelectedItem[]>([]);
  const [period, setPeriod] = React.useState<"Day" | "Week" | "Month">("Week");
  const [sort, setSort] = React.useState<"Rating" | "Downloads">("Rating");
  const router = useRouter();
  // Blacklist state
  const [showBlacklist, setShowBlacklist] = React.useState(false);
  const [blacklist, setBlacklist] = React.useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = React.useState("");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("radar_blacklist");
      if (!raw) return;
      let list: string[] = [];
      try { list = JSON.parse(raw); } catch {
        list = raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
      }
      setBlacklist(list);
      setBlacklistInput(list.join(", "));
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("radar_blacklist", JSON.stringify(blacklist));
    } catch {}
  }, [blacklist]);

  const parseInputToList = (input: string): string[] => {
    return input
      .split(/[,\n]/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
  };

  const openBlacklist = () => setShowBlacklist(true);
  const closeBlacklist = () => setShowBlacklist(false);
  const saveBlacklist = () => {
    const list = parseInputToList(blacklistInput);
    setBlacklist(list);
    setShowBlacklist(false);
  };

  const removeTag = (tag: string) => {
    setBlacklist((prev) => prev.filter((t) => t !== tag.toLowerCase()));
    setBlacklistInput((prev) => parseInputToList(prev).filter((t) => t !== tag.toLowerCase()).join(", "));
  };

  const toggleSelect = (id: number) => {
    const m = items.find((x) => x.id === id);
    if (!m) return;
    const findDownloadUrl = (): string | undefined => {
      const versions = m.modelVersions || [];
      for (const v of versions) {
        if (v.downloadUrl) return v.downloadUrl;
        const files = v.files || [];
        for (const f of files) {
          if (f.downloadUrl) return f.downloadUrl;
        }
      }
      return undefined;
    };
    setSelectedItems((prev) => {
      const exists = prev.some((s) => s.modelId === id);
      if (exists) return prev.filter((s) => s.modelId !== id);
      return [...prev, { modelId: id, downloadUrl: findDownloadUrl() }];
    });
  };

  const filtered = React.useMemo(() => {
    const byTab = (() => {
      if (tab === "Todo") return items;
      const matchers: Record<string, (m: CivitaiModel) => boolean> = {
        "Personajes": (m) => m.ai_category === "Character",
        "Poses/Ropa": (m) => m.ai_category === "Pose" || m.ai_category === "Clothing",
        "Estilo": (m) => m.ai_category === "Style",
        "Conceptos/Otros": (m) => {
          const c = m.ai_category;
          const known = c === "Character" || c === "Pose" || c === "Clothing" || c === "Style" || c === "Concept";
          return c === "Concept" || !c || !known;
        },
      };
      return items.filter((m) => matchers[tab](m));
    })();
    if (blacklist.length === 0) return byTab;
    const blocked = new Set(blacklist.map((t) => t.toLowerCase()));
    const hasBlocked = (m: CivitaiModel) => {
      const tags = (m.tags || []).map((t) => t.toLowerCase());
      for (const t of tags) {
        if (blocked.has(t)) return true;
      }
      return false;
    };
    return byTab.filter((m) => !hasBlocked(m));
  }, [items, tab, blacklist]);

  const deriveTriggerWords = (m: CivitaiModel): string[] => {
    const base = [m.name];
    const tags = (m.tags || []).slice(0, 3);
    return [...base, ...tags].filter((t) => !!t && t.trim().length > 0);
  };


  const handleSendToPlanning = async () => {
    if (selectedItems.length === 0) return;
    const selectedModels = items.filter((m) => selectedItems.some((s) => s.modelId === m.id));
    const payload = selectedModels.map((m) => ({
      character_name: m.name,
      trigger_words: deriveTriggerWords(m),
    }));
    try {
      const res = await postPlannerDraft(payload);
      localStorage.setItem("planner_jobs", JSON.stringify(res.jobs));
      // Nuevo: guardar contexto enriquecido por personaje
      try {
        const contextByCharacter: Record<string, any> = {};
        for (const d of res.drafts || []) {
          contextByCharacter[d.character] = {
            base_prompt: d.base_prompt,
            recommended_params: d.recommended_params,
            reference_images: d.reference_images,
          };
        }
        localStorage.setItem("planner_context", JSON.stringify(contextByCharacter));
      } catch {}
      // Guardar metadatos para la Fábrica (modelId + downloadUrl)
      const meta = selectedModels.map((m) => {
        const versions = m.modelVersions || [];
        let url: string | undefined;
        for (const v of versions) {
          if (v.downloadUrl) { url = v.downloadUrl; break; }
          const files = v.files || [];
          for (const f of files) { if (f.downloadUrl) { url = f.downloadUrl; break; } }
          if (url) break;
        }
        const firstImage = (m.images || []).find((it: any) => it?.type === "image")?.url || m.images?.[0]?.url || undefined;
        return { modelId: m.id, downloadUrl: url, character_name: m.name, image_url: firstImage, trigger_words: deriveTriggerWords(m) };
      });
      localStorage.setItem("planner_meta", JSON.stringify(meta));
      router.push("/planner");
    } catch (e) {
      console.error("Failed to draft planner", e);
      alert("Error al generar plan: " + (e as any)?.message);
    }
  };

  const selectedCount = selectedItems.length;

  return (
    <div className="w-full">
      {/* Toolbar compacta: filtros izquierda, acción derecha */}
      <div className="mb-6 flex flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-zinc-300">Periodo</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-zinc-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <option value="Day">Day</option>
            <option value="Week">Week</option>
            <option value="Month">Month</option>
          </select>
          <label className="text-xs text-zinc-300">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-zinc-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <option value="Rating">Rating</option>
            <option value="Downloads">Downloads</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onScan(period, sort)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-600/30 hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Scan className="h-4 w-4" aria-hidden />
            )}
            {loading ? "Escaneando..." : "Escanear Tendencias"}
          </button>
          <button
            onClick={openBlacklist}
            className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-red-600/20 px-3 py-2 text-sm text-red-100 hover:bg-red-600/30 hover:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-600 cursor-pointer transition-all active:scale-95"
          >
            <ListX className="h-4 w-4" />
            Filtros Negativos
          </button>
        </div>
      </div>
      {error && <p className="-mt-4 mb-4 text-xs text-red-400">{error}</p>}

      {/* Modal Blacklist */}
      {showBlacklist && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-[92vw] max-w-md rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Filtros Negativos</h2>
              <button onClick={closeBlacklist} className="rounded p-1 hover:bg-slate-800">
                <X className="h-4 w-4 text-zinc-300" />
              </button>
            </div>
            <p className="mb-2 text-xs text-zinc-400">Ingresa tags a bloquear (separados por comas o saltos de línea). Ej: furry, 3d, pony</p>
            <textarea
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              className="h-28 w-full resize-none rounded-lg border border-slate-800 bg-slate-900 p-2 text-sm text-zinc-200 placeholder:text-zinc-500"
              placeholder="furry, 3d, pony"
            />
            {blacklist.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {blacklist.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-zinc-300">
                    {t}
                    <button onClick={() => removeTag(t)} className="rounded p-0.5 hover:bg-slate-700">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={closeBlacklist} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-slate-800">Cancelar</button>
              <button onClick={saveBlacklist} className="inline-flex items-center gap-2 rounded-lg border border-green-600 bg-green-600/20 px-3 py-1.5 text-xs text-green-100 hover:bg-green-600/30">
                <Save className="h-4 w-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs de categoría */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[("Todo"), ("Personajes"), ("Poses/Ropa"), ("Estilo"), ("Conceptos/Otros")].map((t) => (
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

      {/* Estado vacío si no hay datos y no está cargando */}
      {!loading && items.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-zinc-300">
          Sin datos. Pulsa Escanear.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full">
          {loading
            ? Array.from({ length: 12 }).map((_, idx) => <SkeletonCard key={idx} />)
            : filtered.map((item, idx) => (
                <CivitaiCard
                  key={item.id}
                  model={item}
                  index={idx + 1}
                  selected={selectedItems.some((s) => s.modelId === item.id)}
                  onToggle={toggleSelect}
                />
              ))}
        </div>
      )}

      {/* Barra de acción flotante inferior */}
      <div className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${selectedCount > 0 ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}>
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="rounded-t-2xl border border-slate-800 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur p-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-200">{selectedCount} Items seleccionados</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendToPlanning}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm text-violet-100 hover:bg-violet-600/30 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
              >
                <Send className="h-4 w-4" aria-hidden />
                Enviar a Planificación
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-zinc-200 hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Limpiar selección
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}