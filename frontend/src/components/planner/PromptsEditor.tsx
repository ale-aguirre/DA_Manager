"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Save, FolderOpen } from "lucide-react";
import { usePlannerContext } from "../../context/PlannerContext";
import { getPresetsList, readPreset, openPresetsFolder } from "../../lib/api";

export default function PromptsEditor(props: {
  basePrompt: string;
  negativePrompt: string;
  onChangeBase: (v: string) => void;
  onChangeNegative: (v: string) => void;
}) {
  const { basePrompt, negativePrompt, onChangeBase, onChangeNegative } = props;
  const { setUiState } = usePlannerContext();
  const [presetsList, setPresetsList] = useState<string[]>([]);
  const [showPresetsList, setShowPresetsList] = useState(false);
  const [loadTarget, setLoadTarget] = useState<'positive' | 'negative'>('positive');

  // Load presets list function
  const loadPresetsList = useCallback(async () => {
    try {
      const res = await getPresetsList();
      setPresetsList(res.files);
    } catch {
      console.error("Failed to load presets list");
    }
  }, []);

  // Load presets list on mount
  useEffect(() => {
    void loadPresetsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open presets folder
  const handleOpenFolder = useCallback(async () => {
    try {
      const result = await openPresetsFolder();
      console.log("Folder opened:", result);
      setUiState({ toast: { message: `Carpeta abierta: ${result.path}`, type: "success" } });
    } catch (error) {
      console.error("Error opening folder:", error);
      setUiState({ toast: { message: "Error al abrir carpeta", type: "error" } });
    }
  }, [setUiState]);

  // Load preset from backend
  const handleLoad = useCallback(async (presetName: string) => {
    try {
      const preset = await readPreset(presetName);
      if (loadTarget === 'positive') {
        onChangeBase(preset.content);
        setUiState({ toast: { message: `Preset "${presetName}" cargado en Positive`, type: "success" } });
      } else {
        onChangeNegative(preset.content);
        setUiState({ toast: { message: `Preset "${presetName}" cargado en Negative`, type: "success" } });
      }
      setShowPresetsList(false);
    } catch {
      setUiState({ toast: { message: "Error al cargar preset", type: "error" } });
    }
  }, [onChangeBase, onChangeNegative, setUiState, loadTarget]);

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Positive Prompt */}
      <div className="relative group">
        <label className="mb-1 block text-xs font-bold text-green-400/80">GLOBAL POSITIVE</label>
        <textarea
          value={basePrompt}
          onChange={(e) => onChangeBase(e.target.value)}
          placeholder="masterpiece, best quality..."
          className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 focus:border-green-500/50 focus:outline-none"
        />
        <div className="absolute top-8 right-2 flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpenFolder}
            className="rounded bg-slate-800 p-1.5 text-slate-400 hover:text-green-400 transition-colors"
            title="Abrir Carpeta de Presets"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setLoadTarget('positive');
              setShowPresetsList(!showPresetsList);
            }}
            className="rounded bg-slate-800 p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
            title="Cargar Preset"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Negative Prompt */}
      <div className="relative group">
        <label className="mb-1 block text-xs font-bold text-red-400/80">GLOBAL NEGATIVE</label>
        <textarea
          value={negativePrompt}
          onChange={(e) => onChangeNegative(e.target.value)}
          placeholder="low quality, bad anatomy..."
          className="h-24 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200 focus:border-red-900/50 focus:outline-none"
        />
        <div className="absolute top-8 right-2 flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpenFolder}
            className="rounded bg-slate-800 p-1.5 text-slate-400 hover:text-green-400 transition-colors"
            title="Abrir Carpeta de Presets"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setLoadTarget('negative');
              setShowPresetsList(!showPresetsList);
            }}
            className="rounded bg-slate-800 p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
            title="Cargar Preset"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Presets List Dropdown - SIMPLIFICADO: Todos los archivos */}
      {showPresetsList && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-400">
              PRESETS GUARDADOS (Cargar en {loadTarget === 'positive' ? 'Positive' : 'Negative'})
            </h4>
            <button
              onClick={() => setShowPresetsList(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cerrar
            </button>
          </div>

          {presetsList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">No hay presets guardados</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {presetsList.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleLoad(preset.replace('.txt', ''))}
                  className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-violet-900/30 hover:text-violet-300 transition-colors text-left"
                  title={`Cargar "${preset}" en ${loadTarget === 'positive' ? 'Positive' : 'Negative'}`}
                >
                  <span className="truncate block">📄 {preset.replace('.txt', '')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
