"use client";
import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Shirt,
  Trash2,
  User,
  Zap,
  Bot,
  Sparkles, // Nuevo icono para Alter Fate
  RefreshCw,
  Download,
  ExternalLink,
  Camera
} from "lucide-react";
import {
  extractTriplet,
  getIntensity,
  extractExtras,
} from "../../helpers/planner";
import { splitPrompt, QUALITY_SET } from "../../helpers/planner";

export default function ProductionQueue(props: {
  perCharacter: Record<
    string,
    {
      jobs: Array<{ prompt: string; ai_meta?: Record<string, unknown> }>;
      indices: number[];
    }
  >;
  resources: {
    outfits: string[];
    poses: string[];
    locations: string[];
    lighting?: string[];
    camera?: string[];
    expressions?: string[];
    hairstyles?: string[];
    upscalers?: string[];
  } | null;
  metaByCharacter: Record<
    string,
    { image_url?: string; trigger_words?: string[]; download_url?: string }
  >;
  loreByCharacter: Record<string, string>;
  setLoreByCharacter: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  analyzeLore: (character: string) => void | Promise<void>;
  applyQuickEdit: (
    row: number,
    field: "outfit" | "pose" | "location",
    value: string
  ) => void;
  applyExtrasEdit: (
    row: number,
    field: "lighting" | "camera" | "expression" | "hairstyle",
    value: string
  ) => void;
  updatePrompt: (idx: number, value: string) => void;
  aiReasoningByJob: Record<number, string>;
  aiReasoningByCharacter: Record<string, string>;
  magicFix: (idx: number) => void | Promise<void>;
  toggleDetails: (idx: number) => void;
  showDetails: Set<number>;
  intensityBusy: Set<number>;
  handleDeleteJob: (character: string, localIndex: number) => void;
  handleDeleteCharacter: (character: string) => void;
  handleIntensityChange: (
    idx: number,
    nextLabel: "SFW" | "ECCHI" | "NSFW"
  ) => void;
  loading?: boolean;
}) {
  const {
    perCharacter,
    resources,
    metaByCharacter,
    loreByCharacter,
    setLoreByCharacter,
    analyzeLore,
    applyQuickEdit,
    applyExtrasEdit,
    updatePrompt,
    aiReasoningByJob,
    aiReasoningByCharacter,
    magicFix,
    toggleDetails,
    showDetails,
    intensityBusy,
    handleDeleteJob,
    handleDeleteCharacter,
    handleIntensityChange,
    loading,
  } = props;

  const [opStatus, setOpStatus] = React.useState<Record<string, string>>({});
  const [loraBusy, setLoraBusy] = React.useState<Record<string, boolean>>({});
  const [civitaiBusy, setCivitaiBusy] = React.useState<Record<string, boolean>>(
    {}
  );
  const [hairstyleSelection, setHairstyleSelection] = React.useState<
    Record<number, string>
  >({});

  const downloadLora = async (character: string) => {
    try {
      setLoraBusy((prev) => ({ ...prev, [character]: true }));
      const api = await import("../../lib/api");
      const list = await api.getLocalLoras();
      const sanitize = (s: string) =>
        s
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_\-.]/g, "");
      const stem = sanitize(character);
      if ((list.files || []).includes(stem)) {
        setOpStatus((prev) => ({ ...prev, [character]: "Ya descargado" }));
        setLoraBusy((prev) => ({ ...prev, [character]: false }));
        return;
      }
      const url = metaByCharacter[character]?.download_url || "";
      if (!url) {
        setOpStatus((prev) => ({
          ...prev,
          [character]: "Sin URL de descarga",
        }));
        setLoraBusy((prev) => ({ ...prev, [character]: false }));
        return;
      }
      const fname = `${stem}.safetensors`;
      await api.postDownloadLora(url, fname);
      try {
        const info = await api.getLocalLoraInfo(character);
        const words = Array.isArray(info?.trainedWords)
          ? info.trainedWords.join(", ")
          : "";
        setOpStatus((prev) => ({
          ...prev,
          [character]: words ? `Descargado · Triggers: ${words}` : "Descargado",
        }));
      } catch {
        setOpStatus((prev) => ({
          ...prev,
          [character]: "Descargado (sin info)",
        }));
      }
      setLoraBusy((prev) => ({ ...prev, [character]: false }));
    } catch {
      setOpStatus((prev) => ({ ...prev, [character]: "Error al descargar" }));
      setLoraBusy((prev) => ({ ...prev, [character]: false }));
    }
  };

  const openCivitai = async (character: string) => {
    try {
      setCivitaiBusy((prev) => ({ ...prev, [character]: true }));
      const api = await import("../../lib/api");
      // Preferir info local (id/modelId) si disponible
      let url: string | null = null;
      try {
        const info = await api.getLocalLoraInfo(character);
        const modelId = info?.modelId || null;
        const versionId = info?.id || null;
        if (modelId && versionId) {
          url = `https://civitai.com/models/${modelId}?modelVersionId=${versionId}`;
        } else if (versionId) {
          url = `https://civitai.com/model-versions/${versionId}`;
        } else if (modelId) {
          url = `https://civitai.com/models/${modelId}`;
        }
      } catch {}
      // Fallback a meta de la tarjeta si no hubo info local
      if (!url) {
        const raw = metaByCharacter[character]?.download_url || "";
        const vMatch = raw.match(/model-versions\/(\d+)/);
        const mMatch = raw.match(/download\/models\/(\d+)/);
        if (vMatch && vMatch[1]) {
          url = `https://civitai.com/model-versions/${vMatch[1]}`;
        } else if (mMatch && mMatch[1]) {
          url = `https://civitai.com/models/${mMatch[1]}`;
        }
      }
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        setOpStatus((prev) => ({
          ...prev,
          [character]: "Abriendo Civitai...",
        }));
      } else {
        setOpStatus((prev) => ({
          ...prev,
          [character]: "No se pudo resolver URL de Civitai",
        }));
      }
    } catch {
      setOpStatus((prev) => ({
        ...prev,
        [character]: "Error abriendo Civitai",
      }));
    } finally {
      setCivitaiBusy((prev) => ({ ...prev, [character]: false }));
    }
  };

  const updatePrompts = async (character: string) => {
    try {
      const api = await import("../../lib/api");
      let triggers: string[] = [];
      try {
        const info = await api.getLocalLoraInfo(character);
        triggers = Array.isArray(info?.trainedWords) ? info.trainedWords : [];
      } catch {
        triggers = Array.isArray(metaByCharacter[character]?.trigger_words)
          ? (metaByCharacter[character]!.trigger_words as string[])
          : [];
      }
      const sanitize = (s: string) =>
        s
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_\-.]/g, "");
      const stem = sanitize(character);
      const loraTag = `<lora:${stem}:0.8>`;
      const cleanTriggers = Array.from(
        new Set(triggers.map((t) => t.trim()).filter(Boolean))
      );
      const jobsList = perCharacter[character]?.jobs || [];
      for (let i = 0; i < jobsList.length; i++) {
        const idx = perCharacter[character]!.indices[i];
        const tokens = splitPrompt(jobsList[i].prompt);
        const tokensLower = new Set(tokens.map((t) => t.toLowerCase()));
        const hasCurrentLora = tokens.some((t) =>
          new RegExp(`^<lora:${stem}(:[0-9.]+)?>$`, "i").test(t)
        );
        const rest: string[] = [];
        const quality: string[] = [];
        for (const t of tokens) {
          const low = t.toLowerCase();
          const isAnyLora = /^<lora:[^>]+>$/i.test(t);
          if (isAnyLora) continue; // removemos todas las loras para reinsertar sólo una
          if (QUALITY_SET.has(low)) {
            quality.push(t);
          } else {
            rest.push(t);
          }
        }
        const dedup: string[] = [];
        const seenLower = new Set<string>();
        const pushOne = (x: string) => {
          const lx = x.toLowerCase();
          if (seenLower.has(lx)) return;
          seenLower.add(lx);
          dedup.push(x);
        };
        // 1) Lora actual: insertar sólo si no estaba
        if (!hasCurrentLora) pushOne(loraTag);
        // 2) Triggers: agregar sólo los que no existan
        for (const trig of cleanTriggers) {
          const tl = trig.toLowerCase();
          if (!tokensLower.has(tl)) pushOne(trig);
        }
        // 3) Resto del prompt (dedup conservador)
        for (const t of rest) pushOne(t);
        // 4) Quality al final
        for (const q of quality) pushOne(q);
        updatePrompt(idx, dedup.join(", "));
      }
      setOpStatus((prev) => ({ ...prev, [character]: "Prompts actualizados" }));
    } catch {
      setOpStatus((prev) => ({
        ...prev,
        [character]: "Error al actualizar prompts",
      }));
    }
  };

  const IntensitySelector: React.FC<{
    value: "SFW" | "ECCHI" | "NSFW";
    onChange: (v: "SFW" | "ECCHI" | "NSFW") => void;
    stop?: (e: React.MouseEvent) => void;
  }> = ({ value, onChange, stop }) => {
    const [open, setOpen] = React.useState(false);
    const styles: Record<
      "SFW" | "ECCHI" | "NSFW",
      { trigger: string; text: string; hover: string }
    > = {
      SFW: {
        trigger: "bg-green-600 text-white border-green-700",
        text: "text-green-400",
        hover: "hover:bg-green-700/30",
      },
      ECCHI: {
        trigger: "bg-yellow-500 text-black border-yellow-600",
        text: "text-yellow-400",
        hover: "hover:bg-yellow-600/30",
      },
      NSFW: {
        trigger: "bg-red-600 text-white border-red-700",
        text: "text-red-400",
        hover: "hover:bg-red-700/30",
      },
    };
    const st = styles[value];
    return (
      <div className="relative" onClick={(e) => (stop ? stop(e) : undefined)}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border ${st.trigger}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {value}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
        {open && (
          <div
            className="absolute right-0 z-20 mt-1 w-28 rounded border border-slate-700 bg-slate-900 shadow-lg"
            role="listbox"
          >
            {(["SFW", "ECCHI", "NSFW"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`block w-full text-left px-2 py-1 text-xs ${styles[opt].text} ${styles[opt].hover}`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="mt-3 space-y-6" role="list">
        {Object.keys(perCharacter).map((character) => (
          <article
            key={`production-${character}`}
            id={`production-${character}`}
            role="listitem"
            aria-labelledby={`production-title-${character}`}
            className="rounded-lg border border-slate-800 bg-slate-900 p-3"
          >
            <header className="pb-2 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h4
                  id={`production-title-${character}`}
                  className="text-base md:text-lg font-semibold text-slate-100"
                >
                  {character}
                </h4>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-zinc-400">
                    {perCharacter[character]?.jobs.length ?? 0} jobs
                  </div>
                  {(perCharacter[character]?.jobs.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Borrar todos los jobs de ${character}?`
                          )
                        ) {
                          handleDeleteCharacter(character);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-700/20 px-2 py-1 text-[11px] text-red-100 hover:bg-red-700/30"
                    >
                      <Trash2 className="h-3 w-3" /> Borrar personaje
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-300">LORE CONTEXT</label>
                  <textarea
                    value={loreByCharacter[character] || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLoreByCharacter((prev) => {
                        const next = { ...prev, [character]: v };
                        try {
                          localStorage.setItem(
                            "planner_lore_context",
                            JSON.stringify(next)
                          );
                        } catch {}
                        return next;
                      });
                    }}
                    placeholder="Contexto breve del encargo / personaje"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                    rows={2}
                  />
                </div>
                <div>
                  <button
                    onClick={() => analyzeLore(character)}
                    className="rounded-md border border-indigo-700 bg-indigo-700/20 px-3 py-1.5 text-xs text-indigo-100 hover:bg-indigo-700/30"
                  >
                    Analizar
                  </button>
                </div>
              </div>
            </header>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <figure className="lg:col-span-1">
                {metaByCharacter[character]?.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={metaByCharacter[character]!.image_url!}
                    alt={character}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="aspect-[3/4] w-full rounded-md object-cover border border-slate-800"
                  />
                ) : (
                  <div className="aspect-[3/4] w-full rounded-md border border-slate-800 bg-slate-800/40 flex items-center justify-center text-xs text-slate-400">
                    Sin imagen
                  </div>
                )}
                <figcaption className="sr-only">
                  Imagen representativa de {character}
                </figcaption>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => downloadLora(character)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                    disabled={Boolean(loraBusy[character])}
                  >
                    {loraBusy[character] ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />{" "}
                        Descargando...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3 w-3" /> Descargar LoRA
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePrompts(character)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                  >
                    <RefreshCw className="h-3 w-3" /> Actualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => openCivitai(character)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                    disabled={Boolean(civitaiBusy[character])}
                  >
                    {civitaiBusy[character] ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Abriendo...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Ver en Civitai
                      </span>
                    )}
                  </button>
                </div>
                {opStatus[character] ? (
                  <div className="mt-1 text-[11px] text-zinc-400">
                    {opStatus[character]}
                  </div>
                ) : null}
              </figure>
              <div className="lg:col-span-2">
                <ul className="space-y-2">
                  {perCharacter[character]?.jobs.map((job, i) => {
                    const idx = perCharacter[character]!.indices[i];
                    const triplet = extractTriplet(job.prompt);
                    const intensity = getIntensity(job.prompt);
                    const extras = extractExtras(job.prompt);
                    const loraStem = character
                      .toLowerCase()
                      .replace(/\s+/g, "_");
                    const loraTag = `<lora:${loraStem}:0.8>`;
                    const topColor =
                      intensity.label === "SFW"
                        ? "border-green-600"
                        : intensity.label === "ECCHI"
                        ? "border-yellow-500"
                        : "border-red-600";
                    return (
                      <li
                        key={`${character}-${i}`}
                        className={`rounded-lg border border-slate-700 bg-slate-900 p-3 border-t-2 ${topColor}`}
                      >
                        <div
                          onClick={() => toggleDetails(idx)}
                          className="flex items-center justify-between border-b border-slate-700 pb-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">
                              Job #{i + 1}
                            </span>
                          </div>
                          <IntensitySelector
                            value={intensity.label}
                            onChange={(v) => handleIntensityChange(idx, v)}
                            stop={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteJob(character, i);
                              }}
                              className="rounded-md border border-red-700 bg-red-700/20 px-2 py-1 text-xs text-red-100 hover:bg-red-700/30"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDetails(idx);
                              }}
                              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                            >
                              {showDetails.has(idx) ? (
                                <ChevronUp className="h-3 w-3" aria-hidden />
                              ) : (
                                <ChevronDown className="h-3 w-3" aria-hidden />
                              )}
                            </button>
                          </div>
                        </div>
                        {showDetails.has(idx) && (
                          <div className="pt-3 relative">
                            {intensityBusy.has(idx) && (
                              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                <Loader2 className="h-5 w-5 animate-spin text-slate-200" />
                              </div>
                            )}
                            <div className="mb-2 text-[11px] text-slate-300 flex items-center gap-2">
                              <span>{loraTag}</span>
                              {Array.isArray(
                                metaByCharacter[character]?.trigger_words
                              ) &&
                              metaByCharacter[character]!.trigger_words!
                                .length > 0 ? (
                                <span className="text-zinc-400">
                                  {metaByCharacter[
                                    character
                                  ]!.trigger_words!.join(", ")}
                                </span>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <Shirt className="h-3 w-3 text-slate-400" />
                                  <span>Outfit</span>
                                  {typeof job?.ai_meta === "object" &&
                                    job?.ai_meta !== null &&
                                    "outfit" in
                                      (job.ai_meta as Record<
                                        string,
                                        unknown
                                      >) && (
                                      <span className="inline-flex items-center text-blue-300">
                                        <Bot className="h-3 w-3" />
                                      </span>
                                    )}
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={triplet.outfit || ""}
                                  onChange={(e) =>
                                    applyQuickEdit(
                                      idx,
                                      "outfit",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">(vacío)</option>
                                  {resources &&
                                    resources.outfits.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <User className="h-3 w-3 text-slate-400" />
                                  <span>Pose</span>
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={triplet.pose || ""}
                                  onChange={(e) =>
                                    applyQuickEdit(idx, "pose", e.target.value)
                                  }
                                >
                                  <option value="">(vacío)</option>
                                  {resources &&
                                    resources.poses.map((p) => (
                                      <option key={p} value={p}>
                                        {p}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-slate-400" />
                                  <span>Location</span>
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={triplet.location || ""}
                                  onChange={(e) =>
                                    applyQuickEdit(
                                      idx,
                                      "location",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">(vacío)</option>
                                  {resources &&
                                    resources.locations.map((l) => (
                                      <option key={l} value={l}>
                                        {l}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <Zap className="h-3 w-3 text-slate-400" />
                                  <span>Lighting</span>
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={extras.lighting || ""}
                                  onChange={(e) =>
                                    applyExtrasEdit(
                                      idx,
                                      "lighting",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">(vacío)</option>
                                  {resources?.lighting?.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <Camera className="h-3 w-3 text-slate-400" />
                                  <span>Camera</span>
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={extras.camera || ""}
                                  onChange={(e) =>
                                    applyExtrasEdit(
                                      idx,
                                      "camera",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">(vacío)</option>
                                  {resources?.camera?.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <User className="h-3 w-3 text-slate-400" />
                                  <span>Expression</span>
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={extras.expression || ""}
                                  onChange={(e) =>
                                    applyExtrasEdit(
                                      idx,
                                      "expression",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">(vacío)</option>
                                  {[
                                    ...(extras.expression &&
                                    !(resources?.expressions || []).includes(
                                      extras.expression
                                    )
                                      ? [extras.expression]
                                      : []),
                                    ...((resources?.expressions ||
                                      []) as string[]),
                                  ].map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                  <User className="h-3 w-3 text-slate-400" />
                                  <span>Hairstyle</span>
                                </label>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                                  value={hairstyleSelection[idx] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setHairstyleSelection((prev) => ({
                                      ...prev,
                                      [idx]: v,
                                    }));
                                    applyExtrasEdit(idx, "hairstyle", v);
                                  }}
                                >
                                  <option value="">(vacío)</option>
                                  {(
                                    (resources?.hairstyles || []) as string[]
                                  ).map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              {/* Botón Alter Fate (Reemplazo de Magic Fix) */}
                              <button
                                onClick={() => magicFix(idx)}
                                disabled={Boolean(loading)}
                                className="inline-flex items-center gap-2 rounded-md border border-violet-600/50 bg-violet-900/20 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-800/40 disabled:opacity-60 transition-colors"
                              >
                                <Sparkles className="h-4 w-4 text-violet-400" />
                                <span>Alter Fate</span>
                              </button>
                              
                              {/* Botón Random ELIMINADO */}
                              {/* Botón Ver Prompt ELIMINADO */}
                            </div>
                            <div className="mt-3 rounded-md border border-slate-700 bg-slate-800/40 p-2 text-sm text-slate-200">
                              <textarea
                                value={job.prompt}
                                onChange={(e) =>
                                  updatePrompt(idx, e.target.value)
                                }
                                className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
                              />
                              {aiReasoningByJob[idx] ? (
                                <p className="mt-1 text-xs text-zinc-400">
                                  {aiReasoningByJob[idx]}
                                </p>
                              ) : aiReasoningByCharacter[character] ? (
                                <p className="mt-1 text-xs text-zinc-400">
                                  {aiReasoningByCharacter[character]}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}