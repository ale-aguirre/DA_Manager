import React from "react";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import { cn } from "../../lib/utils";
import { Activity, Server } from "lucide-react";
import { motion } from "framer-motion";

interface SidebarStatusProps {
    collapsed: boolean;
}

export function SidebarStatus({ collapsed }: SidebarStatusProps) {
    const { backend, sd } = useSystemStatus();

    return (
        <div className={cn("flex flex-col gap-2 mt-auto p-2 border-t border-slate-900 bg-slate-950/50", collapsed ? "items-center" : "")}>
            {/* Backend Status */}
            <div className={cn("flex items-center gap-2 text-xs", collapsed ? "justify-center" : "")} title="Backend Status">
                <Server className={cn("w-4 h-4", backend ? "text-emerald-500" : "text-rose-500")} />
                {!collapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between w-full"
                    >
                        <span className="text-slate-400 font-medium">Backend</span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider", backend ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20")}>
                            {backend ? "ON" : "OFF"}
                        </span>
                    </motion.div>
                )}
            </div>

            {/* SD Status */}
            <div className={cn("flex items-center gap-2 text-xs", collapsed ? "justify-center" : "")} title="Stable Diffusion Status">
                <Activity className={cn("w-4 h-4", sd ? "text-emerald-500" : "text-rose-500")} />
                {!collapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between w-full"
                    >
                        <span className="text-slate-400 font-medium">SD API</span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider", sd ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20")}>
                            {sd ? "ON" : "OFF"}
                        </span>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
