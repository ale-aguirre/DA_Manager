"use client";

import React from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { Calendar, Hash, PenTool } from "lucide-react";
import { motion } from "framer-motion";

export function MarketingView() {
    const { t } = useTranslation();

    return (
        <div className="flex h-full flex-col min-w-0 overflow-y-auto bg-slate-950" data-section="section-marketing-view">
            <div className="p-4 space-y-8 max-w-6xl mx-auto w-full">
                {/* Title */}
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="rounded-lg bg-pink-500/10 p-2 text-pink-500">
                        <TargetIcon className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 uppercase tracking-wide">
                        {t("marketing.title")}
                    </h1>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: Calendar */}
                    <MarketingCard
                        icon={Calendar}
                        title={t("marketing.card_calendar")}
                        description={t("marketing.desc_calendar")}
                        color="from-blue-500 to-cyan-500"
                    />

                    {/* Card 2: Hashtags */}
                    <MarketingCard
                        icon={Hash}
                        title={t("marketing.card_hashtags")}
                        description={t("marketing.desc_hashtags")}
                        color="from-purple-500 to-pink-500"
                    />

                    {/* Card 3: Copy Generator */}
                    <MarketingCard
                        icon={PenTool}
                        title={t("marketing.card_copy")}
                        description={t("marketing.desc_copy")}
                        color="from-amber-500 to-orange-500"
                    />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center text-slate-500">
                    <p className="text-sm">More tools coming soon...</p>
                </div>
            </div>
        </div>
    );
}

function MarketingCard({
    icon: Icon,
    title,
    description,
    color,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    color: string;
}) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-slate-700 hover:bg-slate-900"
        >
            <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${color} p-3 text-white shadow-lg`}>
                <Icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-200 group-hover:text-white">
                {title}
            </h3>
            <p className="text-sm text-slate-400">
                {description}
            </p>

            {/* Texture/Glow */}
            <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-10 bg-gradient-to-br ${color} pointer-events-none`} />
        </motion.div>
    );
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    );
}

/* Default export for Next.js dynamic imports if needed, though named export is fine for explicit usage */
export default MarketingView;
