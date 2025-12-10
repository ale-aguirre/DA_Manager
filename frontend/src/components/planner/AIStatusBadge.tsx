"use client";

import React, { useState, useEffect } from "react";
import { Brain, Cloud, Cpu } from "lucide-react";
import { getAIStatus } from "../../lib/api";

export default function AIStatusBadge() {
    const [status, setStatus] = useState<{
        provider: string;
        ollama: { model: string; active: boolean } | null;
        groq: { model: string; active: boolean } | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const data = await getAIStatus();
                setStatus(data);
            } catch (error) {
                console.error("Failed to fetch AI status:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !status) {
        return null;
    }

    const isOllama = status.provider === "ollama";
    const Icon = isOllama ? Cpu : Cloud;
    const bgColor = isOllama ? "bg-blue-900/30" : "bg-purple-900/30";
    const borderColor = isOllama ? "border-blue-600" : "border-purple-600";
    const textColor = isOllama ? "text-blue-300" : "text-purple-300";
    const iconColor = isOllama ? "text-blue-400" : "text-purple-400";

    const modelName = isOllama
        ? status.ollama?.model || "unknown"
        : status.groq?.model || "llama3-8b-8192";

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-lg border ${borderColor} ${bgColor} px-3 py-1.5 ${textColor} backdrop-blur-sm`}
            title={`AI Provider: ${status.provider.toUpperCase()}\nModel: ${modelName}`}
        >
            <Brain className={`h-3.5 w-3.5 ${iconColor}`} aria-hidden />
            <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-wide">
                    {status.provider}
                </span>
            </div>
            <span className="text-[9px] text-slate-400">
                {modelName}
            </span>
        </div>
    );
}
