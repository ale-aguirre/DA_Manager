"use client";
import { useEffect, useState } from "react";
import { Radar, Circle } from "lucide-react";
import Sidebar from "../src/components/layout/Sidebar";
import StatCard from "../src/components/dashboard/StatCard";
import LogConsole from "../src/components/dashboard/LogConsole";
import RadarView from "../src/components/radar/RadarView";
import ProcessView from "../src/components/processor/ProcessView";
import type { CivitaiModel } from "../src/types/civitai";
import FactoryControl from "../src/components/factory/FactoryControl";

type View = "dashboard" | "radar" | "ia" | "files" | "settings";

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [items, setItems] = useState<CivitaiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Iniciando sistema..."]);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  useEffect(() => {
    addLog("Dashboard listo.");
  }, []);

  const onScan = async () => {
    setLoading(true);
    setError(null);
    addLog("Escaneando mercado (Civitai LORA, Highest Rated, Week)...");
    try {
      const res = await fetch("http://127.0.0.1:8000/scan/civitai");
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      addLog(`Scan completado: ${list.length} items.`);
    } catch (e: any) {
      const msg = e?.message ?? "Error desconocido";
      setError(msg);
      addLog(`Error en escaneo: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-zinc-50 flex">
      <Sidebar currentView={view} onChangeView={setView} />
      <main className="flex-1 p-8">
        {view === "dashboard" ? (
          <section className="space-y-8">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radar className="h-6 w-6" aria-hidden />
                <h1 className="text-3xl font-bold">Command Center</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-xs">
                  <Circle className="h-3 w-3 text-green-500" /> Backend: Online
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-xs">
                  <Circle className="h-3 w-3 text-violet-500" /> API Civitai: Ready
                </span>
              </div>
            </header>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <StatCard title="Tendencias Detectadas" value={items.length} />
              <StatCard title="Personajes Procesados" value={0} />
              <StatCard title="Archivos Wildcards" value={2} />
            </div>
            <RadarView items={items} loading={loading} error={error} onScan={onScan} />
            <LogConsole logs={logs} />
            <FactoryControl />
          </section>
        ) : view === "ia" ? (
          <section className="space-y-8">
            <ProcessView rawItems={items} />
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{view.toUpperCase()}</h2>
            <p className="text-sm text-zinc-400">Vista en preparación.</p>
          </section>
        )}
      </main>
    </div>
  );
}
