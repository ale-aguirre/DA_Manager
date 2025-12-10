"use client";

import React from "react";
import Toast from "./Toast";

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full flex-col bg-slate-950 text-slate-200">
            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden">
                {children}
            </main>
            {/* Toast Notifications */}
            <Toast />
        </div>
    );
}
