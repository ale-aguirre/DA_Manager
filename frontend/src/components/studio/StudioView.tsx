"use client";
import React, { useEffect, useState } from "react";

interface CheckpointsResponse { titles: string[] }


interface GenerateRequest { prompt?: string; batch_size?: number; cfg_scale?: number }

interface SessionImage { b64: string; path?: string }

import ProgressBar from "../ui/ProgressBar";
import ImageModal from "./ImageModal";

export default function StudioView() {
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>("");
  const [batchSize, setBatchSize] = useState<number>(1);
  const [cfgScale, setCfgScale] = useState<number>(7);
  const [character, setCharacter] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [reforgeWarning, setReforgeWarning] = useState<boolean>(false);
  // Estados nuevos para la tarea de UX
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [sessionImages, setSessionImages] = useState<SessionImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<SessionImage | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // Progreso real
  const [progress, setProgress] = useState<number>(0);
  const [eta, setEta] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>("Generando...");
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  // Cargar checkpoints (montaje y refresco manual)
  const loadCheckpoints = React.useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/reforge/checkpoints`);
      if (res.status === 502) {
        setReforgeWarning(true);
        throw new Error(`Backend error: ${res.status}`);
      }
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data: CheckpointsResponse = await res.json();
      setCheckpoints(data?.titles ?? []);
      setSelectedCheckpoint((prev) => {
        if (prev && (data?.titles ?? []).includes(prev)) return prev;
        return (data?.titles ?? [])[0] || "";
      });
      setReforgeWarning(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Error cargando checkpoints:", msg);
      setReforgeWarning(true);
    }
  }, [baseUrl]);

  useEffect(() => {
    loadCheckpoints();
  }, [loadCheckpoints]);

  const onApplyCheckpoint = async () => {
    if (!selectedCheckpoint) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/reforge/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedCheckpoint }),
      });
      if (res.status === 502) {
        setReforgeWarning(true);
        throw new Error(`Backend error: ${res.status}`);
      }
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      // opcionalmente mostrar feedback
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Error cambiando checkpoint:", msg);
    } finally {
      setLoading(false);
    }
  };

  const onDreamPrompt = async () => {
    if (!character.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/dream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: character.trim(), tags: tags }),
      });
      if (res.status === 502) {
        setReforgeWarning(true);
        throw new Error(`Backend error: ${res.status}`);
      }
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const text = await res.text();
      setPrompt(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Error generando prompt IA:", msg);
    } finally {
      setLoading(false);
    }
  };

  const startProgressPolling = () => {
    // Reset estado
    setProgress(0);
    setEta(null);
    setProgressLabel("Generando...");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${baseUrl}/reforge/progress`);
        if (!res.ok) return; // evitar ruido
        const data = await res.json();
        const p = typeof data?.progress === "number" ? data.progress : 0;
        const etaRel = typeof data?.eta_relative === "number" ? data.eta_relative : null;
        setProgress(p);
        setEta(etaRel);
        setProgressLabel("Generando...");
        if (p >= 1) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
      } catch {
        // silent
      }
    }, 1000);
  };

  const stopProgressPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgressLabel("Completado");
  };

  const onGenerate = async () => {
    setGenerateError(null);
    setIsGenerating(true);
    startProgressPolling();
    try {
      const payload: GenerateRequest = {
        prompt: prompt && prompt.trim() ? prompt.trim() : undefined,
        batch_size: batchSize,
        cfg_scale: cfgScale,
      };
      const res = await fetch(`${baseUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 502) {
        setReforgeWarning(true);
        throw new Error(`Backend error: ${res.status}`);
      }
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const images: string[] = Array.isArray(data?.images) ? data.images : [];
      const paths: string[] = Array.isArray(data?.saved_paths) ? data.saved_paths : [];
      if (images.length > 0) {
        const items: SessionImage[] = images.map((img, idx) => ({ b64: img, path: paths[idx] }));
        setSessionImages((prev) => [...items, ...prev]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Error en generación:", msg);
      setGenerateError(msg || "Error en generación");
    } finally {
      setIsGenerating(false);
      stopProgressPolling();
    }
  };

  const btnClass = "cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center rounded-md px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700";

  return (
    <section className={`space-y-6 ${mounted ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}>
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Studio Mode</h2>
        {loading && <span className="text-xs text-zinc-400">Procesando...</span>}
      </header>
      {reforgeWarning && (
        <div role="alert" className="rounded-md border border-yellow-700 bg-yellow-900 text-yellow-200 p-3 text-sm">
          ⚠️ No se detecta ReForge. Asegúrate de iniciarlo con el argumento `--api`.
        </div>
      )}

      {/* Selector de Modelo */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-medium mb-3">Selector de Modelo</h3>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none"
            value={selectedCheckpoint}
            onChange={(e) => setSelectedCheckpoint(e.target.value)}
          >
            {checkpoints.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button className={btnClass} onClick={onApplyCheckpoint}>Aplicar</button>
          <button
            type="button"
            className={btnClass}
            onClick={loadCheckpoints}
            aria-label="Refrescar Lista"
            title="Refrescar Lista"
          >
            🔄 Refrescar Lista
          </button>
        </div>
      </div>

      {/* Configuración */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-medium mb-3">Configuración</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400">Batch Size: {batchSize}</label>
            <input type="range" min={1} max={10} value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400">CFG Scale: {cfgScale}</label>
            <input type="range" min={1} max={15} value={cfgScale} onChange={(e) => setCfgScale(parseFloat(e.target.value))} className="w-full" />
          </div>
        </div>
      </div>

      {/* Área de Prompting */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="font-medium">Área de Prompting</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none"
            placeholder="Personaje (ej: Frieren)"
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
          />
          <input
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none"
            placeholder="Tags (ej: kuudere, long hair)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button className={btnClass} onClick={onDreamPrompt}>✨ Soñar Prompt (IA)</button>
        </div>
        <textarea
          className="w-full min-h-[140px] rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none"
          placeholder="Prompt generado (editable)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Acción */}
      <div className="flex items-center justify-between">
        <button
          className={`${btnClass} ${isGenerating ? "opacity-70 cursor-not-allowed" : ""}`}
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <span className="inline-flex items-center gap-2">
              Wait... Generating [{batchSize}] images
            </span>
          ) : (
            <>🚀 Generar [{batchSize}] Imágenes</>
          )}
        </button>
      </div>
      {isGenerating && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <ProgressBar value={progress} eta={eta ?? undefined} label={progressLabel} />
        </div>
      )}
      {generateError && (
        <div role="alert" className="mt-3 rounded-md border border-red-700 bg-red-900 text-red-200 p-3 text-sm">
          {generateError}
        </div>
      )}

      {/* Galería de sesión */}
      {sessionImages.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-medium mb-3">Session Gallery</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sessionImages.map((item, idx) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={idx}
                src={`data:image/png;base64,${item.b64}`}
                alt={`Generated ${idx}`}
                className="rounded-md border border-slate-700 w-full h-auto cursor-pointer hover:opacity-90"
                onClick={() => { setSelectedImage(item); setShowModal(true); }}
              />
            ))}
          </div>
        </div>
      )}
      {/* Modal de Imagen */}
      {showModal && selectedImage && (
        <ImageModal
          image={selectedImage}
          promptUsed={prompt}
          character={character}
          baseUrl={baseUrl}
          onClose={() => setShowModal(false)}
          onDeleted={() => {
            setSessionImages((prev) => prev.filter((it) => !(it.b64 === selectedImage.b64 && it.path === selectedImage.path)));
            setShowModal(false);
          }}
        />
      )}
    </section>
  );
}
