"use client";
import React from "react";
import { FolderOpen } from "lucide-react";
import ImageModal, { SessionImage } from "../studio/ImageModal";

interface GalleryItem {
  filename: string;
  path: string;
  url: string;
  character: string;
  timestamp: number;
}

export default function GalleryView() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  const [items, setItems] = React.useState<GalleryItem[]>([]);
  const [page, setPage] = React.useState<number>(1);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = React.useState<string>("");
  const [availableCharacters, setAvailableCharacters] = React.useState<
    string[]
  >([]);
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [selectedImage, setSelectedImage] = React.useState<SessionImage | null>(
    null
  );
  const [overrideBase, setOverrideBase] = React.useState<string>("");
  const [showOverrideInput, setShowOverrideInput] =
    React.useState<boolean>(false);
  const [folders, setFolders] = React.useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = React.useState<string>("");

  const loadPage = React.useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(reset ? 1 : page));
        params.set("limit", "100");
        if (selectedCharacter && selectedCharacter.trim()) {
          params.set("character", selectedCharacter.trim());
        }
        if (overrideBase && overrideBase.trim()) {
          params.set("override_base", overrideBase.trim());
        }
        const res = await fetch(`${baseUrl}/gallery?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            text && text.trim().length > 0
              ? `[${res.status}] ${text}`
              : `HTTP ${res.status}`
          );
        }
        const data: GalleryItem[] = await res.json();
        if (reset) {
          setItems(data);
          setPage(2);
        } else {
          setItems((prev) => [...prev, ...data]);
          setPage((p) => p + 1);
        }
        // recolectar personajes
        const chars = Array.from(
          new Set(
            [...(reset ? data : [...items, ...data])].map((it) => it.character)
          )
        ).sort();
        setAvailableCharacters(chars);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Error cargando galería");
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, page, selectedCharacter, items, overrideBase]
  );

  React.useEffect(() => {
    // cargar primera página
    try {
      const raw = localStorage.getItem("gallery_base_override");
      if (raw) setOverrideBase(raw);
      const last = localStorage.getItem("gallery_last_folder");
      if (last) {
        setSelectedFolder(last);
        setOverrideBase(`OUTPUTS_DIR/${last}/`);
      }
    } catch {}
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/gallery/folders`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setFolders(data);
        }
      } catch {}
    })();
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter]);

  const onClickItem = (it: GalleryItem) => {
    setSelectedImage({ url: `${it.url}`, path: it.path });
    setShowModal(true);
  };

  const selectFolder = async (folder: string) => {
    const v = `OUTPUTS_DIR/${folder}/`;
    setOverrideBase(v);
    setSelectedFolder(folder);
    try {
      localStorage.setItem("gallery_base_override", v);
    } catch {}
    try {
      localStorage.setItem("gallery_last_folder", folder);
    } catch {}
    loadPage(true);
  };

  const openFolder = async (path: string) => {
    try {
      const res = await fetch(`${baseUrl}/system/open-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text && text.trim().length > 0
            ? `[${res.status}] ${text}`
            : `HTTP ${res.status}`
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "No se pudo abrir la carpeta");
    }
  };

  return (
    <section className="grid grid-cols-12 gap-6">
      {/* Sidebar de filtros */}
      <aside className="col-span-12 md:col-span-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-medium mb-3">Carpetas</h3>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {folders.map((f) => (
              <button
                key={f}
                className={`w-full text-left rounded-md px-3 py-2 text-sm ${selectedFolder === f ? "bg-slate-800" : "bg-slate-700/40"}`}
                onClick={() => selectFolder(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => openFolder(".")}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Seleccionar ubicación
            </button>
            <button
              onClick={() => openFolder(selectedFolder || ".")}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Abrir carpeta contenedora
            </button>
          </div>
        </div>
      </aside>

      {/* Grid principal */}
      <main className="col-span-12 md:col-span-9">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Galería</h2>
          <div className="flex items-center gap-2">
            {selectedFolder && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <FolderOpen className="h-3 w-3" />
                <button
                  onClick={() => openFolder(selectedFolder)}
                  className="underline underline-offset-2"
                >
                  {selectedFolder}
                </button>
              </span>
            )}
            <div className="text-xs text-slate-400">
              {items.length} imágenes
            </div>
          </div>
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-700 bg-red-900 text-red-200 p-3 text-sm mb-3"
          >
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.path} className="group relative">
              <img
                src={it.url}
                alt={it.filename}
                title={it.url}
                className="aspect-square w-full object-cover rounded-md border border-slate-700 group-hover:opacity-90"
                loading="lazy"
                onError={(e) => {
                  try {
                    console.error("[Gallery] Error cargando imagen:", it.url);
                  } catch {}
                  (e.currentTarget as HTMLImageElement).classList.add(
                    "opacity-60"
                  );
                }}
              />
              <div className="absolute bottom-1 left-1 right-1 text-[11px] text-white/90 bg-black/30 rounded px-1 py-0.5">
                <span className="truncate block">{it.character}</span>
              </div>
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <button
                  onClick={() => onClickItem(it)}
                  className="rounded bg-slate-900/70 border border-slate-700 text-[10px] text-slate-200 px-2 py-0.5 hover:bg-slate-800"
                >
                  Ver
                </button>
                <button
                  onClick={() => openFolder(it.path)}
                  className="rounded bg-slate-900/70 border border-slate-700 text-[10px] text-slate-200 px-2 py-0.5 hover:bg-slate-800"
                >
                  Abrir carpeta
                </button>
              </div>
            </div>
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
            setItems((prev) =>
              prev.filter((it) => it.path !== selectedImage.path)
            );
            setShowModal(false);
          }}
        />
      )}
    </section>
  );
}
