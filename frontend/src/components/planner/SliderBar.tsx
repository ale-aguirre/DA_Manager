import React from "react";

export function SliderBar({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / Math.max(1, max - min)) * 100));
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    const raw = min + p * (max - min);
    const scaled = Math.round(raw / step) * step;
    const fixed = Number(scaled.toFixed(2));
    onChange(Math.max(min, Math.min(max, fixed)));
  };
  return (
    <div className="mt-2 w-full h-4 bg-slate-700 rounded cursor-pointer" onClick={handleClick}>
      <div style={{ width: `${pct}%` }} className="h-4 bg-blue-600 rounded" />
    </div>
  );
}

