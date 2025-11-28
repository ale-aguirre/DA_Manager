"use client";
import React from "react";
import { Scan, Loader2, Send, Trash2, ListX, X, Save, Search, CheckCircle } from "lucide-react";
import CivitaiCard from "./CivitaiCard";
import type { CivitaiModel } from "../../types/civitai";
import { postPlannerDraft, postCivitaiDownloadInfo, postPlannerAnalyze } from "../../lib/api";
import { useRouter } from "next/navigation";
import COPY from "../../lib/copy";


export interface RadarViewProps {
  items: CivitaiModel[];
  loading: boolean;
  error: string | null;
  onScan: (period: "Day" | "Week" | "Month", sort: "Rating" | "Downloads", query?: string, page?: number) => void;
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
  const [query, setQuery] = React.useState("");
  const lastFiredRef = React.useRef<string>("");
  const [page, setPage] = React.useState<number>(1);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadStates, setDownloadStates] = React.useState<Record<number, "pending" | "ok" | "error" | "skipped">>({});
  const [loaderOpen, setLoaderOpen] = React.useState(false);
  const [infoStates, setInfoStates] = React.useState<Record<number, "ok" | "missing" | "unknown">>({});

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

              // CRITICAL: Update the item in the list with the fetched trainedWords
              if (Array.isArray(j?.trainedWords) && j.trainedWords.length > 0) {
                // We need to update the 'items' state, but 'items' is a prop. 
                // However, we can't mutate props. We should probably have a local state or a way to store this enrichment.
                // Actually, 'deriveTriggerWords' takes a CivitaiModel.
                // Let's mutate the object in place if possible (not ideal but works for this reference) 
                // OR better, store it in a map and use it in deriveTriggerWords.
                // But deriveTriggerWords is used in handleSendToPlanning which iterates 'items'.
                // Let's try to update the item in the 'items' array if it's a reference, or use a ref/map.
                // Since 'items' comes from parent, let's use a side-effect map or just mutate the object found in 'items' 
                // assuming it's a shallow copy or mutable reference from the parent. 
                // Given the constraints, let's try to mutate the found model object directly for now as a quick fix, 
                // or better, create a 'enrichedModels' state.
                // Let's stick to the plan: "Update RadarView to merge fetched trigger words into model items."
                // Since we can't easily change the prop 'items', I will mutate the found 'model' object.
                model.trainedWords = j.trainedWords;
              }
            }
          } catch { }
        }
      } catch { }
    };
    if (confirmOpen) precheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmOpen]);

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
        setPage(1);
        onScan(period, sort, q, 1);
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

  const selectedModels = React.useMemo(() => items.filter((m) => selectedItems.some((s) => s.modelId === m.id)), [items, selectedItems]);

  const startDownloads = async () => {
    setIsDownloading(true);
    // inicializar estado
    setDownloadStates((prev) => {
      const next = { ...prev };
      for (const s of selectedItems) next[s.modelId] = "pending";
      return next;
    });
    try {
      // Pre-check: loras locales para evitar descargas duplicadas
      const local: { files: string[] } = { files: [] };
      try {
        const res = await fetch("http://127.0.0.1:8000/local/loras", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          local.files = Array.isArray(data?.files) ? data.files : [];
        }
      } catch { }
      const sanitize = (name: string) => name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");
      const canonical = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const s of selectedItems) {
        const model = items.find((m) => m.id === s.modelId);
        if (!model) {
          setDownloadStates((prev) => ({ ...prev, [s.modelId]: "skipped" }));
          continue;
        }
        const stem = sanitize(model.name);
        const existsLocal = local.files.some((f) => canonical(f).includes(canonical(model.name)));
        if (existsLocal) {
          setDownloadStates((prev) => ({ ...prev, [s.modelId]: "ok" }));
          continue;
        }
        const url = s.downloadUrl;
        if (!url) {
          setDownloadStates((prev) => ({ ...prev, [s.modelId]: "skipped" }));
          continue;
        }
        try {
          const res = await fetch("http://127.0.0.1:8000/download-lora", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, filename: `${stem}.safetensors` }),
          });
          if (!res.ok) throw new Error(String(res.status));
          setDownloadStates((prev) => ({ ...prev, [s.modelId]: "ok" }));
        } catch {
          setDownloadStates((prev) => ({ ...prev, [s.modelId]: "error" }));
        }
      }

      // Descargar metadata civitai.info si falta
      for (const s of selectedItems) {
        const model = items.find((m) => m.id === s.modelId);
        if (!model) continue;
        const safe = sanitize(model.name);
        try {
          const r = await fetch(`http://127.0.0.1:8000/local/lora-info?name=${encodeURIComponent(safe)}`, { cache: "no-store" });
          let need = true;
          if (r.ok) {
            const j = await r.json();
            const ok = (Array.isArray(j?.trainedWords) && j.trainedWords.length > 0) || j?.id || j?.modelId || (Array.isArray(j?.imageUrls) && j.imageUrls.length > 0);
            need = !ok;
          }
          if (need) {
            try {
              const resp = await postCivitaiDownloadInfo(safe, Number(model.id), undefined);
              if (resp?.status === "downloaded" || resp?.status === "exists") {
                setInfoStates((prev) => ({ ...prev, [s.modelId]: "ok" }));
              }
            } catch {
              setInfoStates((prev) => ({ ...prev, [s.modelId]: "missing" }));
            }
          } else {
            setInfoStates((prev) => ({ ...prev, [s.modelId]: "ok" }));
          }
        } catch {
          // mantener estado anterior
        }
      }
    } finally {
      setIsDownloading(false);
    }
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
    setLoaderOpen(true);
    try {
      const selectedModels = items.filter((m) => selectedItems.some((s) => s.modelId === m.id));

      // 1. Preparar metadatos básicos
      const payload = selectedModels.map((m) => ({
        character_name: m.name,
        trigger_words: deriveTriggerWords(m),
      }));

      // 2. Leer preset global
      let jobCount = 1;
      let preset: Record<string, unknown> | null = null;
      try {
        const raw = localStorage.getItem("planner_preset_global");
        if (raw) {
          preset = JSON.parse(raw) as Record<string, unknown>;
          if (typeof preset.batch_count === "number" && (preset.batch_count as number) > 0) {
            jobCount = preset.batch_count as number;
          }
        }
      } catch { }

      // 3. Generar Drafts iniciales (estructura base)
      const res = await postPlannerDraft(payload, jobCount);

      // 4. PRE-GENERACIÓN: Llamar a analyzeLore para cada personaje
      let enrichedJobs = [...res.jobs];
      const loreMap: Record<string, string> = {};
      const reasoningMap: Record<string, string> = {};

      // Cargamos lo que ya exista para no sobrescribir si no es necesario
      try {
        const oldLore = JSON.parse(localStorage.getItem("planner_lore") || "{}");
        Object.assign(loreMap, oldLore);
      } catch { }

      // Iteramos secuencialmente o en paralelo
      const analysisResults = await Promise.all(selectedModels.map(async (m) => {
        try {
          console.log("📡 [Radar] Iniciando envío para:", m.name);
          const triggers = deriveTriggerWords(m);
          console.log("📡 [Radar] Triggers detectados:", triggers);

          // Llamada al backend para generar escenarios
          console.log("📡 [Radar] Solicitando análisis al backend...");
          const analysis = await postPlannerAnalyze(m.name, triggers, jobCount);
          console.log("📡 [Radar] Respuesta Backend:", analysis);

          return { modelName: m.name, analysis, success: true };
        } catch (e) {
          console.warn(`Fallo pre-generación para ${m.name}`, e);
          return { modelName: m.name, error: e, success: false };
        }
      }));

      // Procesar resultados secuencialmente para evitar race conditions
      analysisResults.forEach((result) => {
        if (result.success && result.analysis) {
          const { modelName, analysis } = result;

          if (analysis.jobs && analysis.jobs.length > 0) {
            // Reemplazamos los jobs "vacíos" del draft con los jobs "inteligentes" del analyze
            const others = enrichedJobs.filter(j => j.character_name !== modelName);

            // Map backend fields to ai_meta for frontend consumption
            const mappedJobs = analysis.jobs.map((j) => ({
              ...j,
              ai_meta: {
                outfit: j.outfit,
                pose: j.pose,
                location: j.location,
                lighting: j.lighting,
                camera: j.camera,
                expression: j.expression,
                intensity: j.intensity,
                extra_loras: j.extra_loras
              }
            }));

            // Reconstruimos el array
            enrichedJobs = [...others, ...mappedJobs];
          }

          if (analysis.lore) {
            loreMap[modelName] = analysis.lore;
          }
          if (analysis.ai_reasoning) {
            reasoningMap[modelName] = analysis.ai_reasoning;
          }
        } else {
          // Fallback Manual: Inyectar escena básica si falla la IA
          const draftJob = enrichedJobs.find(j => j.character_name === result.modelName);
          if (draftJob) {
            const FALLBACK_SCENES = [
              "standing, casual outfit, simple background",
              "sitting, cozy sweater, indoor lighting",
              "portrait, smiling, soft lighting",
              "walking, street fashion, city background"
            ];
            const randomScene = FALLBACK_SCENES[Math.floor(Math.random() * FALLBACK_SCENES.length)];
            // Aseguramos que no se duplique si ya tenía algo
            if (!draftJob.prompt.includes(randomScene)) {
              draftJob.prompt = `${draftJob.prompt}, ${randomScene}`;
            }
          }
        }
      });

      // 5. Guardar Jobs enriquecidos
      console.log("📡 [Radar] Guardando planner_jobs en localStorage:", enrichedJobs);
      localStorage.setItem("planner_jobs", JSON.stringify(enrichedJobs));
      localStorage.setItem("planner_lore", JSON.stringify(loreMap));
      localStorage.setItem("planner_reasoning", JSON.stringify(reasoningMap));

      const stripLora = (s: string): string => (s || "").split(",").map((t) => t.trim()).filter((t) => t.length > 0 && !/^<lora:[^>]+>$/i.test(t)).join(", ");
      const contextByCharacter: Record<string, unknown> = JSON.parse(localStorage.getItem("planner_context") || "{}");

      for (const d of res.drafts || []) {
        const pos = typeof preset?.positivePrompt === "string" && (preset!.positivePrompt as string).trim().length > 0
          ? (preset!.positivePrompt as string)
          : stripLora(d.base_prompt || "");

        contextByCharacter[d.character] = {
          base_prompt: pos,
          recommended_params: d.recommended_params,
          reference_images: d.reference_images,
        };
      }
      localStorage.setItem("planner_context", JSON.stringify(contextByCharacter));

      // 6.5 Forzar Configuración Técnica (Batch Count = 1)
      try {
        const techByCharacter: Record<string, unknown> = JSON.parse(localStorage.getItem("planner_tech") || "{}");
        const selectedModels = items.filter((m) => selectedItems.some((s) => s.modelId === m.id));
        selectedModels.forEach(m => {
          const current = (techByCharacter[m.name] as Record<string, unknown>) || {};
          techByCharacter[m.name] = {
            ...current,
            batch_count: 1
          };
        });
        localStorage.setItem("planner_tech", JSON.stringify(techByCharacter));
      } catch { }

      // 7. Guardar Metadatos (Download URLs, images)
      try {
        const selectedModels = items.filter((m) => selectedItems.some((s) => s.modelId === m.id));
        const rawMeta = JSON.parse(localStorage.getItem("planner_meta") || "{}");
        let metaObj: Record<string, unknown> = {};

        if (Array.isArray(rawMeta)) {
          rawMeta.forEach((m: unknown) => {
            if (m && typeof m === "object" && "character_name" in m) {
              metaObj[(m as { character_name: string }).character_name] = m;
            }
          });
        } else if (typeof rawMeta === "object" && rawMeta !== null) {
          metaObj = rawMeta as Record<string, unknown>;
        }

        const newMeta = selectedModels.map((m) => {
          const versions = m.modelVersions || [];
          let url: string | undefined;
          for (const v of versions) {
            if (v.downloadUrl) { url = v.downloadUrl; break; }
            const files = v.files || [];
            for (const f of files) { if (f.downloadUrl) { url = f.downloadUrl; break; } }
            if (url) break;
          }
          const firstImage = (m.images || []).find((it) => (it as { type?: string })?.type === "image")?.url || m.images?.[0]?.url || undefined;
          return { modelId: m.id, downloadUrl: url, character_name: m.name, image_url: firstImage, trigger_words: deriveTriggerWords(m) };
        });

        // Fusionar meta
        newMeta.forEach(x => {
          metaObj[x.character_name] = x;
        });

        localStorage.setItem("planner_meta", JSON.stringify(metaObj));

        router.push("/planner");
      } catch (e: unknown) {
        throw e;
      }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to draft planner", msg);
      alert("Error al generar plan: " + msg);
    } finally {
      setLoaderOpen(false);
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
              onScan(period, sort, qArg, page);
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
      {/* Paginación */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={() => {
            const next = Math.max(1, page - 1);
            setPage(next);
            const qArg = query.trim().length >= 3 ? query.trim() : undefined;
            onScan(period, sort, qArg, next);
          }}
          disabled={loading || page <= 1}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-slate-800 disabled:opacity-60"
        >
          ← Anterior
        </button>
        <span className="text-xs text-zinc-400">Página {page}</span>
        <button
          onClick={() => {
            const next = page + 1;
            setPage(next);
            const qArg = query.trim().length >= 3 ? query.trim() : undefined;
            onScan(period, sort, qArg, next);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-slate-800 disabled:opacity-60"
        >
          Siguiente →
        </button>
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
                  const state = downloadStates[m.id] || "pending";
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
                      <div className="text-[11px]">
                        <div>
                          {state === "pending" && (isDownloading ? <span className="text-zinc-300">Descargando...</span> : <span className="text-zinc-500">En cola</span>)}
                          {state === "ok" && <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle className="h-3 w-3" /> LoRA OK</span>}
                          {state === "error" && <span className="text-red-400">{COPY.radar.downloadFailed}</span>}
                          {state === "skipped" && <span className="inline-flex items-center gap-1 text-zinc-400"><CheckCircle className="h-3 w-3" /> LoRA OK</span>}
                        </div>
                        <div className="mt-0.5">
                          {infoStates[m.id] === "ok" && <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle className="h-3 w-3" /> Info OK</span>}
                          {infoStates[m.id] === "missing" && <span className="text-yellow-300">Info faltante</span>}
                          {(!infoStates[m.id] || infoStates[m.id] === "unknown") && <span className="text-zinc-500">Info desconocida</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-slate-800">{COPY.radar.confirmCancel}</button>
              {!isDownloading ? (
                <button onClick={async () => { await startDownloads(); setLoaderOpen(true); setConfirmOpen(false); await handleSendToPlanning(); setLoaderOpen(false); }} className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-600/30">
                  {COPY.radar.confirmAccept}
                </button>
              ) : (
                <button disabled className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                  <Loader2 className="h-3 w-3 animate-spin" /> {COPY.radar.downloadProgress}
                </button>
              )}
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
