"use client";
import React from "react";
import { RefreshCw, Trash2, FolderDown } from "lucide-react";

export default function LocalFilesView() {
  const [loras, setLoras] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const fetchLoras = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/local/loras`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.files) ? (data.files as string[]) : [];
      setLoras(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (filename: string) => {
    setDeleting(filename);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/local/lora`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      await fetchLoras();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg ?? "Error desconocido");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderDown className="h-5 w-5" aria-hidden />
          <h2 className="text-2xl font-semibold">Archivos Locales • LoRAs</h2>
        </div>
        <button
          onClick={fetchLoras}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className="h-3 w-3" aria-hidden /> Actualizar
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400">Cargando...</p>
      ) : loras.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay LoRAs instalados.</p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950">
          {loras.map((f) => (
            <li key={f} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm">{f}</span>
              <button
                onClick={() => onDelete(f)}
                disabled={deleting === f}
                className="inline-flex items-center gap-2 rounded border border-red-900 bg-red-950 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40 disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" aria-hidden /> {deleting === f ? "Borrando..." : "🗑️ Borrar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
