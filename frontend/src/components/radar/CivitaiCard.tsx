"use client";
import React from "react";
import Image from "next/image";
import { ImageOff, Heart, Download, Calendar, ExternalLink, CheckCircle } from "lucide-react";
import type { CivitaiModel, CivitaiImage } from "../../types/civitai";


export default function CivitaiCard({ model, index, selected, onToggle }: {
  model: CivitaiModel;
  index: number;
  selected?: boolean;
  onToggle?: (modelId: number) => void;
}) {
  const [videoError, setVideoError] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hoverRef = React.useRef(false);
  const playPromiseRef = React.useRef<Promise<void> | null>(null);

  const primaryImage: CivitaiImage | undefined = model.images?.[0];
  const imageUrl = primaryImage?.url;
  const isVideo = !!primaryImage && (primaryImage.type === "video" || (primaryImage.url?.endsWith(".mp4") || primaryImage.url?.endsWith(".webm")));

  const rank = (index ?? 1) - 1; // 0-based
  const isTop3 = rank >= 0 && rank <= 2;
  const wrapperBorderClass = isTop3 ? "" : "border border-slate-800";
  const neonClass = isTop3
    ? (rank === 0
        ? "neon-border neon-gold"
        : rank === 1
          ? "neon-border neon-silver"
          : "neon-border neon-bronze")
    : "";
  const rankIcon =
    rank === 0 ? "👑" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : (rank === 3 ? "#4" : rank === 4 ? "#5" : undefined);
  const civitaiUrl = `https://civitai.com/models/${model.id}`;

  const handleMouseEnter = () => {
    hoverRef.current = true;
    const v = videoRef.current;
    if (v) {
      const p = v.play();
      playPromiseRef.current = p as Promise<void> | null;
      if (p) {
        (p as Promise<void>).catch(() => {});
      }
    }
  };
  const handleMouseLeave = () => {
    hoverRef.current = false;
    const v = videoRef.current;
    const p = playPromiseRef.current;
    if (v) {
      if (p) {
        (p as Promise<void>).then(() => {
          if (!hoverRef.current) {
            try { v.pause(); } catch {}
          }
        }).catch(() => {});
      } else {
        try { v.pause(); } catch {}
      }
    }
  };

  React.useEffect(() => {
    const videoEl = videoRef.current;
    return () => {
      if (videoEl) {
        try { videoEl.pause(); } catch {}
      }
    };
  }, []);

  const formatCount = (n?: number) => {
    const v = typeof n === "number" ? n : 0;
    if (v >= 1_000_000) return `${Math.round(v/100_000)/10}M`;
    if (v >= 1_000) return `${Math.round(v/100)/10}k`;
    return String(v);
  };
  const formatDate = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  const downloads = model.stats?.downloadCount;
  const likes = model.stats?.thumbsUpCount;
  const createdLabel = formatDate(model.createdAt);

  return (
    <div
      className={`group relative cursor-pointer rounded-xl p-[4px] ${selected ? "ring-1 ring-pink-500" : ""} ${wrapperBorderClass} ${neonClass}`}
      onClick={() => onToggle?.(model.id)}
      style={isTop3 ? (({ ["--spin"]: "8s" } as unknown as React.CSSProperties)) : undefined}
      aria-selected={!!selected}
    >
      <div
        className="relative z-10 h-full w-full rounded-xl bg-slate-900 overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Indicador de ranking Top 5 (emoji/número), sin fondo para no ensuciar la imagen */}
        {rankIcon && (
          <span className="absolute left-2 top-2 z-10 text-white text-xs drop-shadow">{rankIcon}</span>
        )}

        {/* Media */}
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-xl">
          {isVideo && !videoError && imageUrl ? (
            <video
              ref={videoRef}
              className={`h-full w-full object-cover transition-transform duration-300 ${selected ? "opacity-60 saturate-90 brightness-90 scale-100" : "group-hover:scale-105"}`}
              src={imageUrl}
              muted={true}
              playsInline
              loop
              preload="metadata"
              onError={() => setVideoError(true)}
            />
          ) : imageUrl && !imageError ? (
            <Image
              src={imageUrl}
              alt={model.name || "Civitai preview"}
              fill
              className={`object-cover transition-transform duration-300 ${selected ? "opacity-60 saturate-90 brightness-90 scale-100" : "group-hover:scale-105"}`}
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
              priority={index <= 8}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800">
              <div className="flex items-center gap-2 text-zinc-400">
                <ImageOff className="h-5 w-5" aria-hidden />
                <span className="text-xs">No Preview</span>
              </div>
            </div>
          )}

          {/* Overlay e icono de seleccionado */}
          {selected && (
            <>
              <div className="pointer-events-none absolute inset-0 z-10 bg-black/40 backdrop-blur-[1px]"></div>
              <div className="pointer-events-none absolute top-2 left-2 z-20 rounded-full bg-pink-600/80 text-white p-1 ring-1 ring-pink-300">
                <CheckCircle className="h-5 w-5" aria-hidden />
              </div>
            </>
          )}

          {/* Botón de enlace externo (esquina superior derecha) */}
          <button
            onClick={(e) => { e.stopPropagation(); window.open(civitaiUrl, "_blank", "noopener,noreferrer"); }}
            className="absolute top-2 right-2 z-20 rounded-full p-1 bg-black/50 text-white hover:bg-pink-500"
            aria-label="Abrir en Civitai"
          >
            <ExternalLink className="h-4 w-4" />
          </button>

        </div>

        {/* Contenedor inferior: título, tags, estadísticas */}
        <div className="p-2 h-24 flex flex-col gap-1">
          {/* Fila 1: Título flexible (hasta 2 líneas) */}
          <div className="h-12 text-sm leading-tight text-white line-clamp-2">{model.name}</div>
          {/* Fila 2: Tags (máximo 2, con elipsis si no caben) */}
          <div className="flex items-center gap-1 overflow-hidden h-5">
            {model.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="inline-flex items-center rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-zinc-400 truncate max-w-[50%]">
                {tag}
              </span>
            ))}
          </div>
          {/* Fila 3: Estadísticas (descargas, likes, fecha) */}
          <div className="mt-1 flex-1 flex items-center text-[11px] text-zinc-300">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /><span>{formatCount(downloads)}</span></span>
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /><span>{formatCount(likes)}</span></span>
              </div>
              {createdLabel && <span className="hidden lg:inline-flex items-center gap-1 whitespace-nowrap"><Calendar className="h-3 w-3" /><span>{createdLabel}</span></span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
