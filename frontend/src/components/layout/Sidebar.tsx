"use client";
import React from "react";
import { Home as HomeIcon, Satellite, Brain, FolderClosed, Settings, Sparkles } from "lucide-react";

type View = "dashboard" | "radar" | "ia" | "files" | "settings" | "studio";

export interface SidebarProps {
  currentView: View;
  onChangeView: (v: View) => void;
}

const NavItem = ({
  label,
  icon: Icon,
  value,
  active,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  value: View;
  active: boolean;
  onClick: (v: View) => void;
}) => (
  <button
    onClick={() => onClick(value)}
    aria-current={active ? "page" : undefined}
    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all active:scale-95 ${
      active ? "bg-slate-900 border border-slate-800" : "hover:bg-slate-900/60"
    }`}
  >
    <Icon className="h-4 w-4" aria-hidden />
    <span>{label}</span>
  </button>
);

export default function Sidebar({ currentView, onChangeView }: SidebarProps) {
  return (
    <aside className="w-64 h-screen sticky top-0 bg-slate-950 border-r border-slate-800 flex flex-col p-4">
      <div className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="LadyManager Logo"
          className="h-10 w-10 rounded-full border border-slate-800 object-cover"
        />
        <h2 className="text-xl font-bold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 bg-clip-text text-transparent">
          LadyManager
        </h2>
      </div>
      <nav className="flex flex-col gap-1">
        <NavItem
          label="Dashboard"
          icon={HomeIcon}
          value="dashboard"
          active={currentView === "dashboard"}
          onClick={onChangeView}
        />
        <NavItem
          label="Radar Civitai"
          icon={Satellite}
          value="radar"
          active={currentView === "radar"}
          onClick={onChangeView}
        />
        <NavItem
          label="Procesador IA"
          icon={Brain}
          value="ia"
          active={currentView === "ia"}
          onClick={onChangeView}
        />
        <NavItem
          label="Studio"
          icon={Sparkles}
          value="studio"
          active={currentView === "studio"}
          onClick={onChangeView}
        />
        <NavItem
          label="Archivos Locales"
          icon={FolderClosed}
          value="files"
          active={currentView === "files"}
          onClick={onChangeView}
        />
        <NavItem
          label="Configuración"
          icon={Settings}
          value="settings"
          active={currentView === "settings"}
          onClick={onChangeView}
        />
      </nav>
      <div className="mt-auto pt-4 text-xs text-zinc-400">
        <p>v1.0 • Monorepo</p>
      </div>
    </aside>
  );
}