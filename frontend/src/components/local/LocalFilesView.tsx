"use client";
import React, { useMemo } from "react";
import { RefreshCw, Trash2, FolderDown, Edit2, Save, X, Search } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface LoraMetadata {
  filename: string;
  alias: string;
  tags: string[];
  type: string;
  triggers: string[];
  thumbnail?: string;
  base_model?: string;
  size_bytes?: number;
}

export default function LocalFilesView() {
  const { t } = useTranslation();
  const [loras, setLoras] = React.useState<LoraMetadata[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const fetchLoras = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/local/loras`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      setLoras(Array.isArray(data?.files) ? data.files : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLoras();
  }, []);

  const handleUpdate = async (filename: string, data: Partial<LoraMetadata>) => {
    try {
      const res = await fetch(`${baseUrl}/local/update-metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, data }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Update local state optimistic
      setLoras((prev) =>
        prev.map((l) => (l.filename === filename ? { ...l, ...data } : l))
      );
    } catch (e) {
      console.error(e);
      alert("Error saving metadata");
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return loras.filter(
      (loraItem: LoraMetadata) =>
        String(loraItem.filename || "").toLowerCase().includes(s) ||
        String(loraItem.alias || "").toLowerCase().includes(s) ||
        (Array.isArray(loraItem.tags) ? loraItem.tags : []).some((tag) => String(tag || "").toLowerCase().includes(s))
    );
  }, [loras, search]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FolderDown className="h-6 w-6" aria-hidden />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Resource Library
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
            <input
              type="text"
              placeholder="Search resources..."
              className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={fetchLoras}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !loras.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-slate-900 rounded-xl border border-slate-800"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((lora) => (
            <LoraCard key={lora.filename} lora={lora} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      {!loading && !filtered.length && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">No resources found.</p>
        </div>
      )}
    </section>
  );
}

function LoraCard({
  lora,
  onUpdate,
}: {
  lora: LoraMetadata;
  onUpdate: (f: string, d: Partial<LoraMetadata>) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [alias, setAlias] = React.useState(lora.alias || "");
  const [type, setType] = React.useState(lora.type || "Character");

  const saveEdit = () => {
    onUpdate(lora.filename, { alias, type });
    setEditing(false);
  };

  const copyTrigger = (t: string) => {
    navigator.clipboard.writeText(t);
    // Could add toast here
  };

  return (
    <article className="group relative flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden hover:border-slate-600 transition-all shadow-lg hover:shadow-xl">
      {/* Cover Image */}
      <div className="aspect-[2/3] w-full bg-slate-950 relative overflow-hidden">
        {lora.thumbnail ? (
          <img
            src={lora.thumbnail}
            alt={lora.alias || lora.filename}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-700">
            <span className="text-4xl font-black opacity-10 uppercase tracking-widest">{type[0]}</span>
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur text-xs font-semibold text-white border border-white/10">
          {lora.type}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Human Readable Name"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 outline-none"
                >
                  {["Character", "Style", "Outfit", "Pose", "Background", "Vehicle", "Object"].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-slate-100 truncate" title={lora.alias || lora.filename}>
                  {lora.alias || <span className="text-slate-500 italic">No Alias</span>}
                </h3>
                <p className="text-xs text-slate-500 truncate font-mono" title={lora.filename}>
                  {lora.filename}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (editing) saveEdit();
              else setEditing(true);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={editing ? "Save" : "Edit Metadata"}
          >
            {editing ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Triggers */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {lora.triggers?.slice(0, 3).map((t) => (
            <button
              key={t}
              onClick={() => copyTrigger(t)}
              className="max-w-full truncate rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-blue-900/30 hover:text-blue-200 transition-colors"
              title={`Copy: ${t}`}
            >
              {t}
            </button>
          ))}
          {(lora.triggers?.length || 0) > 3 && (
            <span className="text-[10px] text-slate-600 px-1">+{lora.triggers.length - 3}</span>
          )}
        </div>
      </div>
    </article>
  );
}
