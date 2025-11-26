import React, { useState, useEffect, useCallback } from "react";

export interface SessionImage {
  b64?: string;
  url?: string;
  path?: string;
}

interface Props {
  image: SessionImage;
  promptUsed: string;
  character: string;
  baseUrl: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function ImageModal({
  image,
  promptUsed,
  character,
  baseUrl,
  onClose,
  onDeleted,
}: Props) {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // LocalStorage helpers
  const getFileKey = useCallback((): string | null => {
    const p = image?.path || "";
    const base = p.split(/[\\/]/).pop() || "";
    return base ? `marketing_meta::${base}` : null;
  }, [image?.path]);

  // Carga inicial si existen metadatos guardados para la imagen
  useEffect(() => {
    try {
      const key = getFileKey();
      if (!key) return;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setTitle(typeof parsed.title === "string" ? parsed.title : "");
      setDescription(
        typeof parsed.description === "string" ? parsed.description : ""
      );
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags.join(", ")
        : typeof parsed.tags === "string"
        ? parsed.tags
        : "";
      setTagsText(tags || "");
    } catch {
      // ignore parse errors
    }
  }, [image?.path, getFileKey]);

  // Persistencia automática si cambian campos
  useEffect(() => {
    try {
      const key = getFileKey();
      if (!key) return;
      const payload = { title, description, tags: tagsText };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore write errors
    }
  }, [title, description, tagsText, image?.path, getFileKey]);

  const generateInfo = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`${baseUrl}/marketing/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_used: promptUsed ?? "",
          character: character ?? "",
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const outTitle: string = data?.title ?? "";
      const outDesc: string = data?.description ?? "";
      const outTags: string[] = Array.isArray(data?.tags) ? data.tags : [];
      setTitle(outTitle);
      setDescription(outDesc);
      setTagsText(outTags.join(", "));
      // Persistir inmediatamente tras generación
      try {
        const key = getFileKey();
        if (key) {
          const payload = {
            title: outTitle,
            description: outDesc,
            tags: outTags.join(", "),
          };
          localStorage.setItem(key, JSON.stringify(payload));
        }
      } catch {}
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error generando metadata");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    // Formato listo para DeviantArt: TITLE\n\nDESCRIPTION\n\nTAGS
    const text = `${title}\n\n${description}\n\n${tagsText}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("No se pudo copiar al portapapeles");
    }
  };

  const deleteImage = async () => {
    setError(null);
    if (!image.path) {
      setError("Ruta de archivo desconocida para borrar");
      return;
    }
    // Confirmación nativa antes de borrar
    const ok = window.confirm(
      "¿Seguro que quieres borrar esta imagen permanentemente?"
    );
    if (!ok) return;
    try {
      const res = await fetch(
        `${baseUrl}/files?path=${encodeURIComponent(image.path)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      onDeleted();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Error al borrar la imagen");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-6xl mx-4 md:mx-6 lg:mx-8 rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
        <div className="flex flex-col md:flex-row">
          {/* Imagen grande */}
          <div className="md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url ? image.url : `data:image/png;base64,${image.b64}`}
              alt="Imagen generada"
              className="w-full h-auto max-h-[75vh] object-contain rounded"
            />
          </div>
          {/* Panel derecho */}
          <div className="md:w-1/2 p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Inspector de Marketing</h3>
              <p className="text-sm text-slate-300 mt-1">Prompt usado:</p>
              <p className="text-sm text-slate-200 line-clamp-3">
                {promptUsed || "(vacío)"}
              </p>
            </div>

            <button
              onClick={generateInfo}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              <span>🪄 Generar Info para DeviantArt</span>
              {loading && <span className="text-xs">(cargando...)</span>}
            </button>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="title">
                Título
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Título atractivo"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="desc">
                Descripción
              </label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                placeholder="Descripción corta y emocionante"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tags">
                Tags (separados por comas)
              </label>
              <textarea
                id="tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                placeholder="anime, nsfw, cosplay, ..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={copyAll}
                className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm"
              >
                Copiar Todo
              </button>
              {copied && (
                <span className="text-xs text-emerald-400 self-center">
                  Copiado ✓
                </span>
              )}
              <button
                onClick={deleteImage}
                className="rounded-md bg-red-600 hover:bg-red-500 px-3 py-2 text-sm"
              >
                🗑️ Eliminar Imagen
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
