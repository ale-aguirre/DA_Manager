"use client";
import React from "react";
import { getFactoryStatus, postFactoryStop } from "../../lib/api";
import { OctagonX, Square, Eraser } from "lucide-react";

export default function FactoryView() {
  const [isActive, setIsActive] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [character, setCharacter] = React.useState<string | null>(null);
  const [lastImage, setLastImage] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = React.useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = React.useState<any | null>(null);

  React.useEffect(() => {
    let mounted = true;
    let interval: any;
    const poll = async () => {
      try {
        const status = await getFactoryStatus();
        if (!mounted) return;
        setIsActive(Boolean(status.is_active));
        setCurrentIndex(status.current_job_index || 0);
        setTotal(status.total_jobs || 0);
        setCharacter(status.current_character || null);
        setLastImage(status.last_image_b64 || null);
        setLogs(status.logs || []);
        setCurrentPrompt(status.current_prompt || null);
        setCurrentConfig(status.current_config || null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Error consultando estado de Fábrica");
      }
    };
    poll();
    interval = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const progressPercent = total > 0 ? Math.min(100, Math.max(0, Math.round((currentIndex / total) * 100))) : 0;

  const stop = async () => {
    try {
      await postFactoryStop();
    } catch (e: any) {
      setError(e?.message || "Error al solicitar parada");
    }
  };

  const clearLogs = () => { setLogs([]); };

  const severityColor = (line: string) => {
    const s = (line || "").toLowerCase();
    if (s.includes("error") || s.includes("failed")) return "bg-red-500";
    if (s.includes("warn") || s.includes("warning")) return "bg-yellow-500";
    if (s.includes("success") || s.includes("ok") || s.includes("started")) return "bg-green-500";
    return "bg-slate-500";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Centro de Control</h1>
          <p className="mt-1 text-xs text-zinc-400">
            {isActive ? `Procesando trabajo ${currentIndex} de ${total}` : "Fábrica inactiva"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-red-600/20 px-3 py-2 text-xs text-red-100 hover:bg-red-600/30 cursor-pointer transition-all active:scale-95"
            title="Parada de Emergencia"
          >
            <OctagonX className="h-4 w-4" aria-hidden />
            Parada de Emergencia
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Barra de progreso */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="h-2 w-full rounded-full bg-slate-800">
          <div style={{ width: `${progressPercent}%` }} className="h-2 rounded-full bg-emerald-500 transition-all" />
        </div>
        <div className="mt-2 text-xs text-zinc-400">
          {character ? `Objetivo actual: ${character}` : ""}
        </div>
        {/* Prompt y Configuración debajo de la barra de progreso */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="text-xs text-zinc-400">
            <div className="font-medium text-zinc-300">Prompt enviado</div>
            <pre className="mt-1 whitespace-pre-wrap break-words">{currentPrompt || "—"}</pre>
          </div>
          <div className="text-xs text-zinc-400">
            <div className="font-medium text-zinc-300">Configuración</div>
            <ul className="mt-1 space-y-1">
              <li>Steps: {currentConfig?.steps ?? "—"}</li>
              <li>CFG: {currentConfig?.cfg ?? "—"}</li>
              <li>Batch Size: {currentConfig?.batch_size ?? "—"}</li>
              <li>Hires Fix: {currentConfig?.hires_fix ? `ON (x${currentConfig?.hr_scale ?? ""})` : "OFF"}</li>
              <li>Seed: {currentConfig?.seed ?? "—"}</li>
              <li>Checkpoint: {currentConfig?.checkpoint ?? "—"}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Visor en vivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h2 className="text-sm font-medium mb-3">Visor en vivo</h2>
          <div className="aspect-[3/4] w-full rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center overflow-hidden">
            {lastImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lastImage} alt="Última imagen" className="h-full w-full object-contain" />
            ) : (
              <div className="text-xs text-zinc-400 flex items-center gap-2"><Square className="h-3 w-3" /> Sin imagen aún</div>
            )}
          </div>
        </div>

        {/* Consola de logs */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Consola</h2>
            <button
              onClick={clearLogs}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/40 px-2 py-1 text-xs text-zinc-200 hover:bg-slate-800/60 cursor-pointer transition-all active:scale-95"
              title="Limpiar consola"
            >
              <Eraser className="h-4 w-4" aria-hidden />
              Limpiar
            </button>
          </div>
          <div className="h-[420px] w-full rounded-lg border border-slate-800 bg-slate-900 overflow-auto p-3 text-xs font-mono text-zinc-300">
            {logs && logs.length > 0 ? (
              <ul className="space-y-1">
                {logs.map((l, i) => (
                  <li key={`${i}-${l}`} className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1 ${severityColor(l)}`} />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-400">Esperando eventos...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}