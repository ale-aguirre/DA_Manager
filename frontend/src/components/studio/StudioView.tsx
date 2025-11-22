"use client";
import React, { useEffect, useMemo, useState } from "react";

interface CheckpointsResponse { titles: string[] }

interface DreamRequest { character: string; tags?: string }

interface GenerateRequest { prompt?: string; batch_size?: number; cfg_scale?: number }

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

  useEffect(() => { setMounted(true); }, []);

  const baseUrl = "http://127.0.0.1:8000";

  // Cargar checkpoints al montar
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${baseUrl}/reforge/checkpoints`);
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        const data: CheckpointsResponse = await res.json();
        setCheckpoints(data?.titles ?? []);
        if ((data?.titles ?? []).length > 0) setSelectedCheckpoint(data.titles[0]);
      } catch (e: any) {
        console.error("Error cargando checkpoints:", e?.message ?? e);
      }
    };
    load();
  }, []);

  const onApplyCheckpoint = async () => {
    if (!selectedCheckpoint) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/reforge/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedCheckpoint }),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      // opcionalmente mostrar feedback
    } catch (e: any) {
      console.error("Error cambiando checkpoint:", e?.message ?? e);
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
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const text = await res.text();
      setPrompt(text);
    } catch (e: any) {
      console.error("Error generando prompt IA:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  };

  const onGenerate = async () => {
    setLoading(true);
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
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      console.log("Generate response:", data);
    } catch (e: any) {
      console.error("Error en generación:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  };

  const btnClass = "cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center rounded-md px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700";

  return (
    <section className={`space-y-6 ${mounted ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}>
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Studio Mode</h2>
        {loading && <span className="text-xs text-zinc-400">Procesando...</span>}
      </header>

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
        <button className={btnClass} onClick={onGenerate}>🚀 Generar [{batchSize}] Imágenes</button>
      </div>
    </section>
  );
}