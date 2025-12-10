"use client";

import React, { useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { usePlannerContext } from "../../../context/PlannerContext";

export default function Toast() {
    const { uiState, setUiState } = usePlannerContext();
    const toast = uiState.toast;

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setUiState({ toast: null });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, setUiState]);

    if (!toast) return null;

    const icons = {
        success: <CheckCircle className="h-5 w-5 text-green-400" />,
        error: <XCircle className="h-5 w-5 text-red-400" />,
        info: <Info className="h-5 w-5 text-blue-400" />,
    };

    const bgColors = {
        success: "bg-green-950/90 border-green-800",
        error: "bg-red-950/90 border-red-800",
        info: "bg-blue-950/90 border-blue-800",
    };

    return (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 duration-300">
            <div className={`flex items-center gap-3 rounded-lg border ${bgColors[toast.type]} px-4 py-3 shadow-lg backdrop-blur-sm`}>
                {icons[toast.type]}
                <span className="text-sm font-medium text-slate-200">{toast.message}</span>
                <button
                    onClick={() => setUiState({ toast: null })}
                    className="ml-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
