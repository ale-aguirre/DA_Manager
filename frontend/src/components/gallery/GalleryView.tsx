"use client";
import React from "react";
import ImageModal, { SessionImage } from "../studio/ImageModal";

interface GalleryItem {
  filename: string;
  path: string;
  url: string;
  character: string;
  timestamp: number;
}

export default function GalleryView() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  const [items, setItems] = React.useState<GalleryItem[]>([]);
  const [page, setPage] = React.useState<number>(1);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = React.useState<string>("");
  const [availableCharacters, setAvailableCharacters] = React.useState<string[]>([]);
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [selectedImage, setSelectedImage] = React.useState<SessionImage | null>(null);

  const loadPage = React.useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(reset ? 1 : page));
      params.set("limit", "100");
      if (selectedCharacter && selectedCharacter.trim()) {
        params.set("character", selectedCharacter.trim());
      }
      const res = await fetch(`${baseUrl}/gallery?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GalleryItem[] = await res.json();
      if (reset) {
        setItems(data);
        setPage(2);
      } else {
        setItems((prev) => [...prev, ...data]);
        setPage((p) => p + 1);
      }
      // recolectar personajes
      const chars = Array.from(new Set([...(reset ? data : [...items, ...data])].map((it) => it.character))).sort();
      setAvailableCharacters(chars);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error cargando galería");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, page, selectedCharacter, items]);

  React.useEffect(() => {
    // cargar primera página
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter]);

  const onClickItem = (it: GalleryItem) => {
    setSelectedImage({ url: `${it.url}`, path: it.path });
    setShowModal(true);
  };

  return (
    <section className="grid grid-cols-12 gap-6">
      {/* Sidebar de filtros */}
      <aside className="col-span-12 md:col-span-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-medium mb-3">Personajes</h3>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            <button
              className={`w-full text-left rounded-md px-3 py-2 text-sm ${selectedCharacter === "" ? "bg-slate-800" : "bg-slate-700/40"}`}
              onClick={() => setSelectedCharacter("")}
            >
              Todos
            </button>
            {availableCharacters.map((c) => (
              <button
                key={c}
                className={`w-full text-left rounded-md px-3 py-2 text-sm ${selectedCharacter === c ? "bg-slate-800" : "bg-slate-700/40"}`}
                onClick={() => setSelectedCharacter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Grid principal */}
      <main className="col-span-12 md:col-span-9">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Galería</h2>
          <div className="text-xs text-slate-400">{items.length} imágenes</div>
        </div>
        {error && (
          <div role="alert" className="rounded-md border border-red-700 bg-red-900 text-red-200 p-3 text-sm mb-3">{error}</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <button key={it.path} className="group relative" onClick={() => onClickItem(it)}>
              <img
                src={it.url}
                alt={it.filename}
                className="aspect-square w-full object-cover rounded-md border border-slate-700 group-hover:opacity-90"
                loading="lazy"
              />
              <div className="absolute bottom-1 left-1 right-1 text-[11px] text-white/90 bg-black/30 rounded px-1 py-0.5">
                <span className="truncate block">{it.character}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => loadPage(false)}
            disabled={loading}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      </main>

      {/* Modal */}
      {showModal && selectedImage && (
        <ImageModal
          image={selectedImage}
          promptUsed={""}
          character={selectedCharacter || ""}
          baseUrl={baseUrl}
          onClose={() => setShowModal(false)}
          onDeleted={() => {
            setItems((prev) => prev.filter((it) => it.path !== selectedImage.path));
            setShowModal(false);
          }}
        />
      )}
    </section>
  );
}
