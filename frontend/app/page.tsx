"use client";
import Link from "next/link";
import { Radar, Factory, Circle } from "lucide-react";
import StatCard from "../src/components/dashboard/StatCard";

export default function DashboardPage() {
  // Datos mock por ahora; pueden conectarse a GET /stats posteriormente
  const stats = {
    tendencias: 0,
    personajesProcesados: 0,
    archivosWildcards: 2,
  };

  return (
    <section className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="h-6 w-6" aria-hidden />
          <h1 className="text-3xl font-bold">Resumen Ejecutivo</h1>
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

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Tendencias Detectadas" value={stats.tendencias} />
        <StatCard title="Personajes Procesados" value={stats.personajesProcesados} />
        <StatCard title="Archivos Wildcards" value={stats.archivosWildcards} />
      </div>

      {/* Acceso rápido */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/radar"
          className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:bg-slate-900"
        >
          <div className="flex items-center gap-3">
            <Radar className="h-6 w-6" aria-hidden />
            <h2 className="text-xl font-semibold">Ir al Radar</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">Explora modelos y genera borradores de plan.</p>
        </Link>
        <Link
          href="/factory"
          className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:bg-slate-900"
        >
          <div className="flex items-center gap-3">
            <Factory className="h-6 w-6" aria-hidden />
            <h2 className="text-xl font-semibold">Ir a Fábrica</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">Ejecuta producción sobre tus planes aprobados.</p>
        </Link>
      </div>
    </section>
  );
}
