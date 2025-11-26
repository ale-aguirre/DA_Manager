"use client";
import React from "react";

export default function PromptsEditor(props: {
  basePrompt: string;
  negativePrompt: string;
  onChangeBase: (v: string) => void;
  onChangeNegative: (v: string) => void;
}) {
  const { basePrompt, negativePrompt, onChangeBase, onChangeNegative } = props;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <textarea
          value={basePrompt}
          onChange={(e) => onChangeBase(e.target.value)}
          placeholder="Prompt Positivo"
          className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
        />
      </div>
      <div>
        <textarea
          value={negativePrompt}
          onChange={(e) => onChangeNegative(e.target.value)}
          placeholder="Prompt Negativo"
          className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-200"
        />
      </div>
    </div>
  );
}
