"use client";
import React, { useMemo, useState } from "react";
import { Sparkles, Save, User, Activity } from "lucide-react";
import type { CivitaiModel } from "../../types/civitai";

interface AIEntity {
  nombre: string;
  triggers: string[];
}

interface AIOutput {
  personajes: AIEntity[];
  poses: AIEntity[];
}

export interface ProcessViewProps {
  rawItems: CivitaiModel[];
}

export default function ProcessView({ rawItems }: ProcessViewProps) {
  const [apiKey, setApiKey] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIOutput | null>(null);
  const dirtyCount = rawItems.length;

  const samplePreview = useMemo(() => {
    return rawItems.slice(0, 5).map((i) => i.name).join(", ");
  }, [rawItems]);

  const executeProcess = async () => {
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/process-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rawItems, apiKeyOverride: apiKey || undefined }),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      setResult(data as AIOutput);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setProcessing(false);
    }
  };

  const saveOutput = async () => {
    if (!result) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/save-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: result }),
      });
      if (!res.ok) throw new Error(`Error al guardar: ${res.status}`);
      await res.json();
      alert("Guardado en ReForge exitoso.");
    } catch (e: any) {
      alert(e?.message ?? "Error desconocido al guardar");
    }
  };

  return (
    <section className="space-y-6">
      {/* Encabezado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Limpieza Inteligente (Llama 3)</h2>
          <p className="text-sm text-zinc-400">Normaliza nombres y genera trigger words a partir del escaneo.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="GROQ_API_KEY (opcional)"
            className="w-72 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-slate-700"
          />
        </div>
      </header>

      {/* Botón de acción */}
      <div>
        <button
          onClick={executeProcess}
          disabled={processing || dirtyCount === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {processing ? "Procesando..." : "Ejecutar Limpieza IA"}
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {/* Área de resultados */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna izquierda: resumen input */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
          <p className="text-sm text-zinc-400">Entrada</p>
          <p className="mt-2 text-lg font-semibold">{dirtyCount} items sucios detectados</p>
          <p className="mt-2 text-sm text-zinc-400">Muestra:</p>
          <p className="mt-1 text-xs text-zinc-300 line-clamp-3">{samplePreview || "Sin datos"}</p>
        </div>

        {/* Columna derecha: salida IA */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" aria-hidden />
              <p className="text-sm font-semibold">Personajes Identificados</p>
            </div>
            <div className="mt-3 space-y-3">
              {result?.personajes?.length ? (
                result.personajes.map((p, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-sm font-medium">{p.nombre}</p>
                    {p.triggers?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.triggers.map((t, i) => (
                          <span key={i} className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-xs text-zinc-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400">Sin resultados aún.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" aria-hidden />
              <p className="text-sm font-semibold">Poses/Acciones</p>
            </div>
            <div className="mt-3 space-y-3">
              {result?.poses?.length ? (
                result.poses.map((p, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-sm font-medium">{p.nombre}</p>
                    {p.triggers?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.triggers.map((t, i) => (
                          <span key={i} className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-xs text-zinc-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400">Sin resultados aún.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Botón Final: Guardar */}
      {result && (
        <div>
          <button
            onClick={saveOutput}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-medium hover:bg-slate-800 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700"
          >
            <Save className="h-4 w-4" aria-hidden />
            Guardar en ReForge
          </button>
        </div>
      )}
    </section>
  );
}