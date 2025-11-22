"use client";
import React from "react";

export interface LogConsoleProps {
  logs: string[];
  title?: string;
}

export default function LogConsole({ logs, title = "Consola" }: LogConsoleProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 max-h-48 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs text-zinc-300">
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-zinc-500">$</span>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}