/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
"use client";
import React from "react";
import { Scan, Loader2, Send, Trash2, ListX, X, Save, Search, CheckCircle, AlertCircle } from "lucide-react";
import CivitaiCard from "./CivitaiCard";
import type { CivitaiModel } from "../../types/civitai";
import { postPlannerDraft, postPlannerAnalyze, getLoraVerify, postDownloadLora, type LoraVerifyResponse, getLocalLoraInfo, getLocalLoras } from "../../lib/api";
import { useRouter } from "next/navigation";
import COPY from "../../lib/copy";

export interface RadarViewProps {
  items: CivitaiModel[];
  loading: boolean;
  error: string | null;
  onScan: (period: "Day" | "Week" | "Month", sort: "Rating" | "Downloads", query?: string) => void;
}

export type LoraState = {
  status: "idle" | "checking" | "downloading" | "ok" | "missing_safetensors" | "missing_info" | "partial";
  safetensors: boolean;
  info: boolean;
};

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


// Helper para obtener el nombre de archivo real
function getBestFilename(model: CivitaiModel): string {
  // Intentar obtener el nombre del archivo del primer modelo/versión
  if (model.modelVersions && model.modelVersions.length > 0) {
    const v = model.modelVersions[0];
    if (v.files && v.files.length > 0) {
      // Preferir archivo "Model" o "Pruned Model" si existe, sino el primero
      const primary = v.files.find(f => f.type === "Model" || f.type === "Pruned Model") || v.files[0];
      if (primary.name) return primary.name;
    }
  }
  // Fallback al nombre del modelo sanitizado (no ideal pero necesario)
  return model.name.replace(/[^a-zA-Z0-9._-]/g, "_") + ".safetensors";
}

function useAutoVerify(
  enabled: boolean,
  models: CivitaiModel[],
  verifyFn: (filename: string) => Promise<LoraVerifyResponse>,
  setStatuses: React.Dispatch<React.SetStateAction<Record<string, LoraState>>>
) {
  React.useEffect(() => {
    if (!enabled || models.length === 0) return;

    let active = true;
    const run = async () => {
      for (const m of models) {
        if (!active) break;

        try {
          const filename = getBestFilename(m);
          // Mark as checking
          setStatuses(prev => ({
            ...prev,
            [m.name]: { ...(prev[m.name] || { safetensors: false, info: false }), status: "checking" }
          }));

          const res = await verifyFn(filename);
          if (!active) break;

          setStatuses(prev => ({
            ...prev,
            [m.name]: {
              status: res.exists && res.civitai_info ? "ok" : "partial",
              safetensors: res.safetensors,
              info: res.civitai_info
            }
          }));
        } catch (e) {
          if (!active) break;
          setStatuses(prev => ({
            ...prev,
            [m.name]: { status: "missing_safetensors", safetensors: false, info: false }
          }));
        }
      }
    };

    run();
    return () => { active = false; };
  }, [enabled, models]);
}

export default function RadarView({ items, loading, error, onScan }: RadarViewProps) {
  const [tab, setTab] = React.useState<"Todo" | "Personajes" | "Poses/Ropa" | "Estilo" | "Conceptos/Otros">("Personajes");
  type SelectedItem = { modelId: number; downloadUrl?: string };
  const [selectedItems, setSelectedItems] = React.useState<SelectedItem[]>([]);
  const [period, setPeriod] = React.useState<"Day" | "Week" | "Month">("Month");
  const [sort, setSort] = React.useState<"Rating" | "Downloads">("Rating");
  const router = useRouter();

  // Blacklist state
  const [showBlacklist, setShowBlacklist] = React.useState(false);
  const [blacklist, setBlacklist] = React.useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const lastFiredRef = React.useRef<string>("");

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadStates, setDownloadStates] = React.useState<Record<number, "pending" | "ok" | "error" | "skipped">>({});
  const [loaderOpen, setLoaderOpen] = React.useState(false);
  const [infoStates, setInfoStates] = React.useState<Record<number, "ok" | "missing" | "unknown">>({});

  // Verification state
  const [loraStatuses, setLoraStatuses] = React.useState<Record<string, LoraState>>({});
  const [isVerifying, setIsVerifying] = React.useState(false);

  React.useEffect(() => {
    const precheck = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/local/loras", { cache: "no-store" });
        const data = res.ok ? await res.json() : { files: [] };
        const files: string[] = Array.isArray(data?.files) ? data.files : [];
        const canonical = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        setDownloadStates((prev) => {
          const next = { ...prev };
          for (const s of selectedItems) {
            const model = items.find((m) => m.id === s.modelId);
            if (!model) continue;
            const exists = files.some((f) => canonical(f).includes(canonical(model.name)));
            next[s.modelId] = exists ? "ok" : "pending";
          }
          return next;
        });
        // Precheck de civitai.info
        setInfoStates((prev) => {
          const next = { ...prev };
          for (const s of selectedItems) next[s.modelId] = "unknown";
          return next;
        });
        for (const s of selectedItems) {
          const model = items.find((m) => m.id === s.modelId);
          if (!model) continue;
          const safe = model.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");
          try {
            const r = await fetch(`http://127.0.0.1:8000/local/lora-info?name=${encodeURIComponent(safe)}`, { cache: "no-store" });
            if (r.ok) {
              const j = await r.json();
              const ok = (Array.isArray(j?.trainedWords) && j.trainedWords.length > 0) || j?.id || j?.modelId || (Array.isArray(j?.imageUrls) && j.imageUrls.length > 0);
              setInfoStates((prev) => ({ ...prev, [s.modelId]: ok ? "ok" : "missing" }));
            }
          } catch (e) {
            console.error("Failed to check info for", safe, e);
          }
        }
      } catch (e) {
        console.error("Failed to list local loras", e);
      }
    };
    precheck();
  }, [items, selectedItems]);

  // Auto-verify hook
  const selectedModels = React.useMemo(() => items.filter((m) => selectedItems.some((s) => s.modelId === m.id)), [items, selectedItems]);
  useAutoVerify(confirmOpen, selectedModels, getLoraVerify, setLoraStatuses);

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
    } catch { }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("radar_blacklist", JSON.stringify(blacklist));
    } catch { }
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

  React.useEffect(() => {
    const h = setTimeout(() => {
      const q = query.trim();
      if (q.length >= 3 && q !== lastFiredRef.current) {
        onScan(period, sort, q);
        lastFiredRef.current = q;
      }
    }, 800);
    return () => clearTimeout(h);
  }, [query, onScan, period, sort]);

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

  const truncate = (s: string, n = 16) => {
    const raw = (s || "").trim();
    return raw.length <= n ? raw : raw.slice(0, n) + "…";
  };

  const findImageUrl = (m: CivitaiModel): string | undefined => {
    const img = (m.images || []).find((it) => (it as { type?: string })?.type === "image")?.url || m.images?.[0]?.url;
    return img || undefined;
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
    const rules = blacklist.map((entry) => {
      const [rawTag, rawCat] = entry.split(":");
      return { tag: (rawTag || "").trim().toLowerCase(), cat: (rawCat || "").trim().toLowerCase() || null };
    }).filter((r) => r.tag.length > 0);

    const isBlocked = (m: CivitaiModel) => {
      const tags = (m.tags || []).map((t) => (t || "").toLowerCase());
      const cat = (m.ai_category || "").toLowerCase();
      for (const r of rules) {
        if (tags.includes(r.tag)) {
          if (!r.cat || r.cat === cat) return true;
        }
      }
      return false;
    };
    return byTab.filter((m) => !isBlocked(m));
  }, [items, tab, blacklist]);

  const deriveTriggerWords = (m: CivitaiModel): string[] => {
    // Prioridad: trainedWords oficiales
    if (Array.isArray(m.trainedWords) && m.trainedWords.length > 0) {
      return m.trainedWords;
    }
    // Fallback: Nombre + Tags
    const cleanName = m.name.replace(/\(.*\)/g, "").replace(/v\d+/i, "").replace(/SDXL/i, "").trim();
    const base = [cleanName];
    const banned = new Set(["character", "hentai", "anime", "high quality", "masterpiece"]);
    const tags = (m.tags || []).filter((t) => {
      const v = (t || "").trim().toLowerCase();
      return v.length > 0 && !banned.has(v);
    }).slice(0, 5);
    return [...base, ...tags];
  };



  const handleSendToPlanning = async () => {
    if (selectedItems.length === 0) return;
    setIsDownloading(true);

    try {
      const selectedModels = items.filter((m) => selectedItems.some((s) => s.modelId === m.id));

      // 1. Obtener la lista REAL de archivos en disco para hacer match preciso
      let localFiles: string[] = [];
      try {
        const { files } = await getLocalLoras();
        localFiles = files.map(f => f.toLowerCase());
      } catch (e) { console.warn("No se pudo listar loras locales", e); }

      // 2. Clasificación (Personajes vs Recursos)
      const characters = selectedModels.filter(m => {
        const cat = (m.ai_category || "").toLowerCase();
        if (cat === "character") return true;
        const tags = (m.tags || []).join(" ").toLowerCase();
        return tags.includes("character") || tags.includes("girl") || tags.includes("boy") || tags.includes("1girl");
      });

      const resources = selectedModels.filter(m => !characters.includes(m));

      // 3. Construcción del Payload con Búsqueda de Archivo Real
      const payload = await Promise.all(characters.map(async (m) => {
        let finalTriggers = deriveTriggerWords(m); // Fallback inicial

        try {
          // 1. Try to get the EXACT filename from Civitai metadata (the one we downloaded)
          let targetName = m.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");

          const bestFile = getBestFilename(m);
          if (bestFile) {
            // Remove extension for the search (e.g. "foo.safetensors" -> "foo")
            targetName = bestFile.replace(/\.[^/.]+$/, "");
          }

          // 2. Local fuzzy matching (just in case)
          // Improved matching: Canonicalize both names (remove all separators)
          const canonical = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const canonTarget = canonical(targetName);

          const exactMatch = localFiles.find(f => f === targetName.toLowerCase());
          const fuzzyMatch = localFiles.find(f => {
            const canonF = canonical(f);
            return canonF.includes(canonTarget) || canonTarget.includes(canonF);
          });

          const finalName = exactMatch || fuzzyMatch || targetName;

          const info = await getLocalLoraInfo(finalName);

          if (info && Array.isArray(info.trainedWords) && info.trainedWords.length > 0) {
            finalTriggers = [info.trainedWords[0]];
            console.log(`🎯 [Radar] Trigger OFICIAL recuperado para ${m.name} (Archivo: ${finalName}):`, finalTriggers[0]);
          } else {
            console.warn(`⚠️ [Radar] Archivo encontrado (${finalName}) pero sin trainedWords. Usando fallback:`, finalTriggers);
          }
        } catch (e) {
          console.warn(`❌ [Radar] Error consultando info local para ${m.name}:`, e);
        }

        console.log(`✅ [Radar] Final Triggers para ${m.name}:`, finalTriggers);

        return {
          character_name: m.name,
          trigger_words: finalTriggers,
        };
      }));

      // 4. Envío al Backend (Solo Personajes)
      if (payload.length > 0) {
        const res = await postPlannerDraft(payload, 1); // Batch count 1
        localStorage.setItem("planner_jobs", JSON.stringify(res.jobs));

        // Guardar Contexto
        try {
          const context: any = {};
          res.drafts.forEach((d: any) => {
            context[d.character] = {
              base_prompt: d.base_prompt,
              recommended_params: d.recommended_params,
              reference_images: d.reference_images
            };
          });
          localStorage.setItem("planner_context", JSON.stringify(context));
        } catch { }
      }

      // 5. Guardar Metadatos (Todos)
      const meta = selectedModels.map((m) => {
        const charData = payload.find(p => p.character_name === m.name);
        const realTrigger = charData ? charData.trigger_words : deriveTriggerWords(m);

        let dUrl: string | undefined = undefined;
        if (m.modelVersions?.[0]?.downloadUrl) dUrl = m.modelVersions[0].downloadUrl;
        else if (m.modelVersions?.[0]?.files?.[0]?.downloadUrl) dUrl = m.modelVersions[0].files[0].downloadUrl;

        const img = (m.images || []).find((it: any) => it.type === "image")?.url || m.images?.[0]?.url;

        return {
          modelId: m.id,
          downloadUrl: dUrl,
          character_name: m.name,
          image_url: img,
          trigger_words: realTrigger,
          type: characters.includes(m) ? "Character" : "Resource"
        };
      });

      let existingMeta: any[] = [];
      try {
        const raw = JSON.parse(localStorage.getItem("planner_meta") || "[]");
        existingMeta = Array.isArray(raw) ? raw : [];
      } catch { existingMeta = []; }

      const newMeta = [...existingMeta.filter((e: any) => !meta.find(n => n.character_name === e.character_name)), ...meta];
      localStorage.setItem("planner_meta", JSON.stringify(newMeta));

      if (payload.length > 0) {
        router.push("/planner");
      } else {
        if (resources.length > 0) alert("Recursos guardados en librería. (Sin personajes seleccionados)");
        setIsDownloading(false);
        setSelectedItems([]);
      }

    } catch (e: any) {
      alert("Error crítico en Radar: " + e.message);
      setIsDownloading(false);
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
            onChange={(e) => setPeriod(e.target.value as "Day" | "Week" | "Month")}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-zinc-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <option value="Day">Day</option>
            <option value="Week">Week</option>
            <option value="Month">Month</option>
          </select>
          <label className="text-xs text-zinc-300">Sort</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "Rating" | "Downloads")}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-zinc-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <option value="Rating">Rating</option>
            <option value="Downloads">Downloads</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={COPY.radar.searchPlaceholder}
              className="w-[220px] rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-slate-700"
            />
          </div>
          <button
            onClick={() => {
              const q = query.trim();
              const qArg = q.length >= 3 ? q : undefined;
              onScan(period, sort, qArg);
              if (qArg) lastFiredRef.current = qArg;
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-600/30 hover:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Scan className="h-4 w-4" aria-hidden />
            )}
            {loading ? "Escaneando..." : "Buscar / Escanear"}
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
        {(["Todo", "Personajes", "Poses/Ropa", "Estilo", "Conceptos/Otros"] as Array<"Todo" | "Personajes" | "Poses/Ropa" | "Estilo" | "Conceptos/Otros">).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs cursor-pointer transition-all active:scale-95 ${tab === t
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
          {query.trim().length >= 3 ? `No se encontraron resultados para '${query.trim()}'` : "Sin datos. Pulsa Escanear."}
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
            <div className="flex items-center gap-3 overflow-x-auto max-w-[70vw]">
              <span className="text-sm font-medium text-zinc-200">{COPY.radar.cartLabel}: {selectedCount}</span>
              {selectedModels.map((m) => (
                <div key={m.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1">
                  {findImageUrl(m) ? (
                    <img src={findImageUrl(m)!} alt={m.name} className="h-6 w-6 rounded object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="inline-block h-6 w-6 rounded bg-slate-700" />
                  )}
                  <span title={m.name} className="text-xs text-zinc-200">{truncate(m.name)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm text-violet-100 hover:bg-violet-600/30 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
              >
                <Send className="h-4 w-4" aria-hidden />
                {COPY.radar.sendToPlanning}
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-zinc-200 hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {COPY.radar.clearSelection}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación y descargas */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-[92vw] max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">{COPY.radar.confirmTitle}</h2>
              <button onClick={() => setConfirmOpen(false)} className="rounded p-1 hover:bg-slate-800"><X className="h-4 w-4 text-zinc-300" /></button>
            </div>
            <p className="mb-3 text-xs text-zinc-400">{COPY.radar.confirmDesc}</p>
            <div className="max-h-[40vh] overflow-y-auto rounded border border-slate-800">
              <ul className="divide-y divide-slate-800">
                {selectedModels.map((m) => {
                  const status = loraStatuses[m.name] || { status: "idle", safetensors: false, info: false };
                  const url = selectedItems.find((s) => s.modelId === m.id)?.downloadUrl;
                  return (
                    <li key={m.id} className="flex items-center gap-3 p-2">
                      {findImageUrl(m) ? (
                        <img src={findImageUrl(m)!} alt={m.name} className="h-8 w-8 rounded object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="inline-block h-8 w-8 rounded bg-slate-700" />
                      )}
                      <div className="flex-1">
                        <div className="text-xs text-zinc-200" title={m.name}>{truncate(m.name)}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{url || "Sin URL de descarga"}</div>
                      </div>
                      <div className="text-[11px] flex flex-col gap-1">
                        {/* LoRA Status */}
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-500">LoRA:</span>
                          {status.status === "checking" || status.status === "downloading" ? (
                            <span className="text-blue-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> ...</span>
                          ) : status.safetensors ? (
                            <span className="text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> OK</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><X className="h-3 w-3" /> Falta</span>
                          )}
                        </div>
                        {/* Info Status */}
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-500">Info:</span>
                          {status.status === "checking" ? (
                            <span className="text-blue-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> ...</span>
                          ) : status.info ? (
                            <span className="text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> OK</span>
                          ) : (
                            <span className="text-yellow-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Falta</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={async () => {
                  setIsVerifying(true);
                  const newStatuses = { ...loraStatuses };

                  for (const m of selectedModels) {
                    const current = newStatuses[m.name] || { status: "idle", safetensors: false, info: false };
                    if (current.status === "ok") continue;

                    try {
                      const filename = getBestFilename(m);
                      console.log(`[ManualVerify] Processing ${m.name} -> ${filename}`);
                      // 1. Verify
                      let res = await getLoraVerify(filename);

                      if (!res.safetensors) {
                        // 2. Download if missing
                        const url = selectedItems.find(s => s.modelId === m.id)?.downloadUrl;
                        if (url) {
                          newStatuses[m.name] = { ...current, status: "downloading" };
                          setLoraStatuses({ ...newStatuses });
                          await postDownloadLora(url, filename);
                          res = await getLoraVerify(filename);
                        }
                      }

                      if (!res.civitai_info) {
                        // Try to download info if missing (optional but good)
                        // For now just mark as missing info if not found
                        // Ideally we would call postCivitaiDownloadInfo here if we had the ID
                        // But let's assume the user wants to know it's missing
                      }

                      newStatuses[m.name] = {
                        status: res.exists && res.civitai_info ? "ok" : "partial",
                        safetensors: res.safetensors,
                        info: res.civitai_info
                      };
                    } catch (e) {
                      console.error(e);
                      newStatuses[m.name] = { status: "missing_safetensors", safetensors: false, info: false };
                    }
                    setLoraStatuses({ ...newStatuses });
                  }
                  setIsVerifying(false);
                }}
                disabled={isVerifying}
                className="rounded-lg border border-blue-600 bg-blue-600/20 px-4 py-2 text-xs text-blue-100 hover:bg-blue-600/30 disabled:opacity-50"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
                  </span>
                ) : (
                  "Verificar & Descargar Faltantes"
                )}
              </button>

              <div className="flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-zinc-200 hover:bg-slate-800">Cancelar</button>
                <button
                  onClick={async () => {
                    setLoaderOpen(true);
                    setConfirmOpen(false);
                    await handleSendToPlanning();
                    setLoaderOpen(false);
                  }}
                  disabled={isVerifying || !selectedModels.every(m => loraStatuses[m.name]?.status === "ok" || (loraStatuses[m.name]?.safetensors && loraStatuses[m.name]?.info))}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-xs text-violet-100 hover:bg-violet-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {COPY.radar.confirmAccept}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loader de pantalla completa */}
      {loaderOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-violet-400 mx-auto" />
            <p className="mt-3 text-sm text-zinc-300">{COPY.radar.loaderWorking}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper para obtener el nombre de archivo real

