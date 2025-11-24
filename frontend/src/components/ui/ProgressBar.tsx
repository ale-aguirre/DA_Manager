"use client";
import React from "react";

export interface ProgressBarProps {
  value: number; // 0..1
  eta?: number | null; // segundos restantes (eta_relative)
  label?: string;
}

function formatEta(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const rr = String(r).padStart(2, "0");
  return `${mm}:${rr}`;
}

export default function ProgressBar({ value, eta, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value || 0) * 100)));
  const etaStr = formatEta(eta);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-300">{label || "Progreso"}</span>
        <span className="text-xs text-zinc-400">{pct}% {etaStr && `· ${etaStr}`}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-2 bg-gradient-to-r from-violet-500 to-pink-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}