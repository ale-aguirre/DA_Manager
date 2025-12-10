"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Loader2, Image as ImageIcon } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface LoraInfo {
    name: string;
    alias?: string;
    thumbnail?: string;
    tags?: string[];
    type?: string;
}

interface LoraGalleryModalProps {
    onClose: () => void;
    onSelect: (loraName: string) => void;
}

type FilterType = "all" | "character" | "style" | "clothing" | "helpers";

export default function LoraGalleryModal({ onClose, onSelect }: LoraGalleryModalProps) {
    const [loras, setLoras] = useState<LoraInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");

    // Load LoRAs on mount
    useEffect(() => {
        const loadLoras = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${BASE_URL}/local/loras-with-metadata`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch LoRAs: ${response.status}`);
                }
                const data = await response.json();
                setLoras(data.loras || []);
            } catch (error) {
                console.error("Failed to load LoRAs:", error);
                setLoras([]);
            } finally {
                setLoading(false);
            }
        };

        void loadLoras();
    }, []);


    // Filter logic
    const filteredLoras = loras.filter((lora) => {
        // Search filter
        const matchesSearch =
            !searchQuery ||
            (lora.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (lora.alias?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (lora.tags || []).some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

        // Type filter
        const matchesType =
            activeFilter === "all" ||
            (lora.type?.toLowerCase() || "").includes(activeFilter.toLowerCase());

        return matchesSearch && matchesType;
    });

    const handleSelect = (loraName: string) => {
        onSelect(loraName);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-6xl h-[85vh] rounded-xl border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 p-4">
                    <h2 className="text-lg font-bold text-slate-200">Galería de LoRAs</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="border-b border-slate-800 p-4 space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                        <input
                            type="text"
                            placeholder="Buscar LoRAs por nombre, alias o tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 overflow-x-auto">
                        {(["all", "character", "style", "clothing", "helpers"] as FilterType[]).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`px-4 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeFilter === filter
                                    ? "bg-violet-600 text-white"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                    }`}
                            >
                                {filter === "all" && "Todos"}
                                {filter === "character" && "Personajes"}
                                {filter === "style" && "Estilos"}
                                {filter === "clothing" && "Ropa"}
                                {filter === "helpers" && "Helpers"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden />
                        </div>
                    ) : filteredLoras.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-slate-500">No se encontraron LoRAs</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {filteredLoras.map((lora) => (
                                <button
                                    key={lora.name}
                                    onClick={() => handleSelect(lora.name)}
                                    className="group relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900 transition-all hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 hover:scale-105"
                                >
                                    {/* Thumbnail */}
                                    <div className="aspect-[3/4] relative bg-slate-800">
                                        {lora.thumbnail ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={lora.thumbnail}
                                                alt={lora.alias || lora.name}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <ImageIcon className="h-12 w-12 text-slate-600" aria-hidden />
                                            </div>
                                        )}

                                        {/* Overlay on hover */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    </div>

                                    {/* Info */}
                                    <div className="p-2">
                                        <p className="truncate text-sm font-medium text-slate-200">
                                            {lora.alias || lora.name}
                                        </p>
                                        {lora.type && (
                                            <p className="truncate text-xs text-slate-500">{lora.type}</p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-800 p-4">
                    <p className="text-center text-xs text-slate-500">
                        {filteredLoras.length} LoRA{filteredLoras.length !== 1 ? "s" : ""} encontrado{filteredLoras.length !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>
        </div>
    );
}
