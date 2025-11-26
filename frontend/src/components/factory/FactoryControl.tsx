"use client";
import { useState } from "react";
import { Rocket, AlertCircle, Loader2 } from "lucide-react";
/* eslint-disable @next/next/no-img-element */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function FactoryControl() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/generate`, { method: "POST" });
      if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
      const data = await resp.json();
      const images = Array.isArray(data?.images) ? data.images : [];
      if (images.length === 0) throw new Error("Respuesta sin imágenes.");
      setLastImage(images[0]);
      setInfo(typeof data?.info === "string" ? data.info : JSON.stringify(data?.info ?? {}, null, 2));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg ?? "Error desconocido");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section aria-label="Línea de Montaje ReForge" className="rounded-xl border border-violet-500/40 bg-slate-900/60 p-6 shadow-[0_0_24px_rgba(139,92,246,0.25)]">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Línea de Montaje ReForge</h3>
        {isGenerating ? (
          <span className="inline-flex items-center gap-2 text-sm text-violet-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cocinando Waifu...
          </span>
        ) : null}
      </header>

      {error ? (
        <div className="mb-4 rounded-md border border-red-600/40 bg-red-900/30 p-3 text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>Error: ReForge Offline. {error}</span>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-6">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-4 text-base font-semibold text-white hover:bg-violet-500 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer transition-all active:scale-95"
          aria-disabled={isGenerating}
        >
          <Rocket className="h-5 w-5" aria-hidden />
          INICIAR GENERACIÓN (1 Lote)
        </button>

        <div className="flex-1">
          <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
            {isGenerating ? (
              <div className="h-[256px] w-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" aria-hidden />
                <span className="ml-2 text-sm text-zinc-300">Cocinando Waifu...</span>
              </div>
            ) : lastImage ? (
              <img
                src={`data:image/png;base64,${lastImage}`}
                alt="Última imagen generada"
                className="mx-auto max-h-[512px] w-auto rounded-md"
              />
            ) : (
              <div className="h-[256px] w-full flex items-center justify-center text-zinc-400">
                <span className="text-sm">Sin resultados aún. Genera un lote para ver la salida aquí.</span>
              </div>
            )}
          </div>
          {info ? (
            <p className="mt-2 text-xs text-zinc-400 break-words">info: {info}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
