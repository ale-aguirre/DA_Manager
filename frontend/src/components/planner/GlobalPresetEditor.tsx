"use client";
import React from "react";

export default function GlobalPresetEditor() {
  const [positive, setPositive] = React.useState("");
  const [negative, setNegative] = React.useState("");
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("planner_preset_global");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.positivePrompt === "string") {
        setPositive(parsed.positivePrompt as string);
      }
      if (typeof parsed.negativePrompt === "string") {
        setNegative(parsed.negativePrompt as string);
      }
    } catch {}
  }, []);
  const updatePreset = (patch: Record<string, unknown>) => {
    try {
      const raw = localStorage.getItem("planner_preset_global");
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = { ...prev, ...patch };
      localStorage.setItem("planner_preset_global", JSON.stringify(next));
    } catch {}
  };
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-6">
        <label className="text-xs text-slate-300">Default Positive</label>
        <textarea
          value={positive}
          onChange={(e) => {
            setPositive(e.target.value);
            updatePreset({ positivePrompt: e.target.value });
          }}
          className="mt-2 h-20 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
        />
      </div>
      <div className="col-span-6">
        <label className="text-xs text-slate-300">Default Negative</label>
        <textarea
          value={negative}
          onChange={(e) => {
            setNegative(e.target.value);
            updatePreset({ negativePrompt: e.target.value });
          }}
          className="mt-2 h-20 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
        />
      </div>
    </div>
  );
}

