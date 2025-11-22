"use client";
import React from "react";
import RadarView from "../../src/components/radar/RadarView";
import type { CivitaiModel } from "../../src/types/civitai";

export default function RadarPage() {
  const [items, setItems] = React.useState<CivitaiModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onScan = async (
    period: "Day" | "Week" | "Month" = "Week",
    sort: "Rating" | "Downloads" = "Rating"
  ) => {
    setLoading(true);
    setError(null);
    try {
      const sortParam = sort === "Rating" ? "Highest Rated" : "Most Downloaded";
      const periodParam = period;
      const res = await fetch(`http://127.0.0.1:8000/scan/civitai?period=${encodeURIComponent(periodParam)}&sort=${encodeURIComponent(sortParam)}`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      try { localStorage.setItem('radar_cache', JSON.stringify(list)); } catch (e) {}
    } catch (e: any) {
      const msg = e?.message ?? "Error desconocido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Smart Cache: mostrar datos guardados sin llamar al backend
    try {
      const cached = localStorage.getItem('radar_cache');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) setItems(list as any);
      }
    } catch (e) {
      // noop
    }
    // No auto-scan: el usuario decide cuándo escanear
  }, []);

  return (
    <div className="mx-auto w-full px-4 md:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">Radar</h1>
        <p className="mt-1 text-sm text-zinc-400">Selecciona modelos LORA y envíalos al Planificador.</p>
      </header>
      <RadarView items={items} loading={loading} error={error} onScan={onScan} />
    </div>
  );
}