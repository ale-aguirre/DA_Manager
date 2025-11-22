"use client";
import React from "react";
import { Wand2, Trash2, RefreshCw, Play, Radar, Search } from "lucide-react";
import type { PlannerJob } from "../../types/planner";
import { magicFixPrompt, getPlannerResources } from "../../lib/api";
import { useRouter } from "next/navigation";
import type { ResourceMeta } from "../../lib/api";

// Palabras de calidad para detectar el segmento final del prompt
const QUALITY_SET = new Set([
  "masterpiece",
  "best quality",
  "absurdres",
  "nsfw",
]);

function splitPrompt(prompt: string): string[] {
  return (prompt || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function extractTriplet(prompt: string): { outfit?: string; pose?: string; location?: string } {
  const tokens = splitPrompt(prompt);
  // Quitar tokens de calidad al final
  const core: string[] = [];
  for (const t of tokens) {
    core.push(t);
  }
  // Remover desde el final las palabras de calidad
  while (core.length > 0) {
    const last = core[core.length - 1].toLowerCase();
    if (QUALITY_SET.has(last)) core.pop();
    else break;
  }
  // Esperamos: [..., outfit, pose, location]
  const n = core.length;
  if (n >= 3) {
    return { outfit: core[n - 3], pose: core[n - 2], location: core[n - 1] };
  }
  return {};
}

function rebuildPromptWithTriplet(original: string, nextTriplet: { outfit?: string; pose?: string; location?: string }): string {
  const tokens = splitPrompt(original);
  const core: string[] = [];
  const quality: string[] = [];
  for (const t of tokens) {
    if (QUALITY_SET.has(t.toLowerCase())) quality.push(t);
    else core.push(t);
  }
  // Asegurar que hay al menos 3 posiciones al final para outfit/pose/location
  while (core.length < 3) core.push("");
  if (nextTriplet.outfit !== undefined) core[core.length - 3] = nextTriplet.outfit;
  if (nextTriplet.pose !== undefined) core[core.length - 2] = nextTriplet.pose;
  if (nextTriplet.location !== undefined) core[core.length - 1] = nextTriplet.location;
  const all = [...core, ...quality];
  return all.join(", ");
}

export default function PlannerView() {
  const [jobs, setJobs] = React.useState<PlannerJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resources, setResources] = React.useState<{ outfits: string[]; poses: string[]; locations: string[] } | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [openEditor, setOpenEditor] = React.useState<{ row: number; field: "outfit" | "pose" | "location" } | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("planner_jobs");
      if (raw) {
        const parsed = JSON.parse(raw) as PlannerJob[];
        setJobs(parsed);
      }
    } catch (e) {
      console.error("Failed to load planner_jobs", e);
    }
  }, []);

  React.useEffect(() => {
    // Cargar recursos para edición rápida
    (async () => {
      try {
        const data = await getPlannerResources();
        setResources(data);
      } catch (e) {
        console.warn("No se pudieron cargar recursos del planner:", e);
      }
    })();
  }, []);

  const updatePrompt = (idx: number, value: string) => {
    setJobs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], prompt: value };
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  const regenerateSeed = (idx: number) => {
    setJobs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], seed: Math.floor(Math.random() * 2_147_483_647) };
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  const deleteRow = (idx: number) => {
    setJobs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected((prev) => {
      const s = new Set(prev);
      s.delete(idx);
      return s;
    });
  };

  const magicFix = async (idx: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await magicFixPrompt(jobs[idx].prompt);
      updatePrompt(idx, res.prompt);
    } catch (e: any) {
      setError(e?.message || "Error en MagicFix");
    } finally {
      setLoading(false);
    }
  };

  const startProduction = async () => {
    try {
      setLoading(true);
      setError(null);
      const { postPlannerExecute } = await import("../../lib/api");
      // Cargar metadatos desde localStorage y normalizar claves
      let resourcesMeta: ResourceMeta[] = [];
      try {
        const rawMeta = localStorage.getItem("planner_meta");
        if (rawMeta) {
          const parsed = JSON.parse(rawMeta) as any[];
          resourcesMeta = parsed.map((m: any) => ({
            character_name: m.character_name || m.name || "",
            download_url: m.download_url || m.downloadUrl || undefined,
            filename: m.filename || (m.character_name || m.name || "").toLowerCase().replace(/\s+/g, "_"),
          }));
        }
      } catch (e) {
        console.warn("planner_meta inválido o ausente", e);
      }
      await postPlannerExecute(jobs, resourcesMeta);
      router.push("/factory");
    } catch (e: any) {
      setError(e?.message || "Error iniciando producción");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (idx: number) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
      return s;
    });
  };

  const deleteSelected = () => {
    setJobs((prev) => {
      const next = prev.filter((_, i) => !selected.has(i));
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
    setSelected(new Set());
  };

  const regenerateSelectedSeeds = () => {
    setJobs((prev) => {
      const next = prev.map((job, i) => {
        if (!selected.has(i)) return job;
        return { ...job, seed: Math.floor(Math.random() * 2_147_483_647) };
      });
      localStorage.setItem("planner_jobs", JSON.stringify(next));
      return next;
    });
  };

  const openQuickEdit = (row: number, field: "outfit" | "pose" | "location") => {
    setOpenEditor({ row, field });
  };

  const applyQuickEdit = (row: number, field: "outfit" | "pose" | "location", value: string) => {
    const next = rebuildPromptWithTriplet(jobs[row].prompt, { [field]: value });
    updatePrompt(row, next);
    setOpenEditor(null);
  };

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20">
            <Radar className="h-8 w-8 text-violet-400" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold">Tu plan de batalla está vacío</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Selecciona objetivos en el Radar y envíalos al Planificador para comenzar.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push("/radar")}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm text-violet-100 hover:bg-violet-600/30 cursor-pointer transition-all active:scale-95"
            >
              <Search className="h-4 w-4" aria-hidden />
              Ir al Radar para buscar objetivos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">
          Planificador de Batalla
        </h1>
        <button
          onClick={startProduction}
          disabled={jobs.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
        >
          <Play className="h-4 w-4" aria-hidden />
          Iniciar producción
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Sel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Personaje</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Outfit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Pose</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Prompt</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Seed</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {jobs.map((job, idx) => {
              const triplet = extractTriplet(job.prompt);
              return (
                <tr key={`${job.character_name}-${idx}`} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleSelected(idx)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-600"
                      aria-label={`Seleccionar fila ${idx + 1}`}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="text-sm text-zinc-200">{job.character_name}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openQuickEdit(idx, "outfit")}
                        className="rounded-full border border-pink-600 bg-pink-600/20 px-2 py-1 text-xs text-pink-100 hover:bg-pink-600/30 cursor-pointer transition-all"
                      >
                        {triplet.outfit || "—"}
                      </button>
                      {openEditor && openEditor.row === idx && openEditor.field === "outfit" && resources && (
                        <select
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-zinc-100 focus:ring-violet-600"
                          defaultValue={triplet.outfit}
                          onChange={(e) => applyQuickEdit(idx, "outfit", e.target.value)}
                        >
                          <option value="">(vacío)</option>
                          {resources.outfits.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openQuickEdit(idx, "pose")}
                        className="rounded-full border border-violet-600 bg-violet-600/20 px-2 py-1 text-xs text-violet-100 hover:bg-violet-600/30 cursor-pointer transition-all"
                      >
                        {triplet.pose || "—"}
                      </button>
                      {openEditor && openEditor.row === idx && openEditor.field === "pose" && resources && (
                        <select
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-zinc-100 focus:ring-violet-600"
                          defaultValue={triplet.pose}
                          onChange={(e) => applyQuickEdit(idx, "pose", e.target.value)}
                        >
                          <option value="">(vacío)</option>
                          {resources.poses.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openQuickEdit(idx, "location")}
                        className="rounded-full border border-emerald-600 bg-emerald-600/20 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-600/30 cursor-pointer transition-all"
                      >
                        {triplet.location || "—"}
                      </button>
                      {openEditor && openEditor.row === idx && openEditor.field === "location" && resources && (
                        <select
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-zinc-100 focus:ring-violet-600"
                          defaultValue={triplet.location}
                          onChange={(e) => applyQuickEdit(idx, "location", e.target.value)}
                        >
                          <option value="">(vacío)</option>
                          {resources.locations.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <textarea
                      className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                      value={job.prompt}
                      rows={3}
                      onChange={(e) => updatePrompt(idx, e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-200">{job.seed}</span>
                      <button
                        onClick={() => regenerateSeed(idx)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-zinc-300 hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden />
                        Regenerar
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => magicFix(idx)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 rounded-md border border-violet-600 bg-violet-600/20 px-2 py-1 text-xs text-violet-100 hover:bg-violet-600/30 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
                      >
                        <Wand2 className="h-3 w-3" aria-hidden />
                        Magic Fix
                      </button>
                      <button
                        onClick={() => deleteRow(idx)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-600 bg-red-600/20 px-2 py-1 text-xs text-red-100 hover:bg-red-600/30 cursor-pointer transition-all active:scale-95"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-0 right-0 mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-3 backdrop-blur">
            <span className="text-sm text-zinc-300">{selected.size} seleccionadas</span>
            <div className="flex items-center gap-2">
              <button
                onClick={deleteSelected}
                className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-red-600/20 px-3 py-1.5 text-xs text-red-100 hover:bg-red-600/30 cursor-pointer transition-all"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Eliminar seleccionadas
              </button>
              <button
                onClick={regenerateSelectedSeeds}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-slate-800 cursor-pointer transition-all"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Regenerar Seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}