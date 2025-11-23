"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Radar, Settings, ClipboardList, Factory, Image as ImageIcon } from "lucide-react";

// Remove props interface; Sidebar no longer requires props when used in global layout
// export interface SidebarProps {
//   currentView: "dashboard" | "radar" | "ia" | "files" | "settings" | "studio";
//   onChangeView: (v: "dashboard" | "radar" | "ia" | "files" | "settings" | "studio") => void;
// }

const NavLink = ({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) => (
  <Link
    href={href}
    aria-current={active ? "page" : undefined}
    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all active:scale-95 ${
      active ? "bg-slate-900 border border-slate-800" : "hover:bg-slate-900/60"
    }`}
  >
    <Icon className="h-4 w-4" aria-hidden />
    <span>{label}</span>
  </Link>
);

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

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
        <NavLink href="/" label="Dashboard" icon={LayoutDashboard} active={isActive("/")} />
        <NavLink href="/radar" label="Radar" icon={Radar} active={isActive("/radar")} />
        <NavLink href="/planner" label="Planificador" icon={ClipboardList} active={isActive("/planner")} />
        <NavLink href="/gallery" label="Galería" icon={ImageIcon} active={isActive("/gallery")} />
        <NavLink href="/factory" label="Fábrica" icon={Factory} active={isActive("/factory")} />
        <NavLink href="/settings" label="Configuración" icon={Settings} active={isActive("/settings")} />
      </nav>
      <div className="mt-auto pt-4 text-xs text-zinc-400">
        <p>v1.0 • Monorepo</p>
      </div>
    </aside>
  );
}