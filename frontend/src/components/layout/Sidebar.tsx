"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radar,
  Settings,
  ClipboardList,
  Factory,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Target,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";
import { SidebarStatus } from "./SidebarStatus";
import { useTranslation } from "../../hooks/useTranslation";

const NavLink = ({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
}) => (
  <Link
    href={href}
    className={`flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 group ${collapsed ? "justify-center px-2" : "gap-3 px-3"
      } ${active
        ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-900/20"
        : "text-slate-400 hover:bg-slate-900 hover:text-pink-400"
      }`}
    title={collapsed ? label : undefined}
  >
    <Icon
      className={`h-5 w-5 min-w-[20px] ${active ? "text-white" : "group-hover:text-pink-400"
        }`}
    />
    {!collapsed && (
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="whitespace-nowrap"
      >
        {label}
      </motion.span>
    )}
  </Link>
);

export default function Sidebar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useTranslation();
  const isActive = (path: string) => pathname === path;
  const [collapsed, setCollapsed] = React.useState(false);

  // Persistencia del estado
  React.useEffect(() => {
    const savedState = localStorage.getItem("ui_sidebar_collapsed");
    if (savedState === "1") setCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("ui_sidebar_collapsed", newState ? "1" : "0");
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  return (
    <>
      <motion.aside
        className="h-screen sticky top-0 bg-slate-950 border-r border-slate-900 flex flex-col flex-shrink-0 overflow-hidden z-40"
        initial={false}
        animate={{
          width: collapsed ? 56 : 260,
          opacity: 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="p-4 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="LadyManager Logo"
              className="h-9 w-9 rounded-full border border-slate-800 object-cover flex-shrink-0"
            />
            {!collapsed && (
              <span className="font-bold text-lg bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                LadyManager
              </span>
            )}
          </div>

          <button
            onClick={toggleSidebar}
            className="p-1.5 text-pink-400 hover:text-pink-300 transition-colors rounded-md hover:bg-slate-900"
            aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
            title={collapsed ? "Mostrar menú" : "Ocultar menú"}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navegación */}
        <nav className={`flex-1 ${collapsed ? "px-1" : "px-3"} space-y-1 overflow-y-auto custom-scrollbar`}
        >
          <NavLink
            href="/"
            label={t("nav.dashboard")}
            icon={LayoutDashboard}
            active={isActive("/")}
            collapsed={collapsed}
          />
          <NavLink
            href="/radar"
            label={t("nav.radar")}
            icon={Radar}
            active={isActive("/radar")}
            collapsed={collapsed}
          />
          <NavLink
            href="/planner"
            label={t("nav.planner")}
            icon={ClipboardList}
            active={isActive("/planner")}
            collapsed={collapsed}
          />
          <NavLink
            href="/factory"
            label={t("nav.production")}
            icon={Factory}
            active={isActive("/factory")}
            collapsed={collapsed}
          />
          <NavLink
            href="/gallery"
            label={t("nav.gallery")}
            icon={ImageIcon}
            active={isActive("/gallery")}
            collapsed={collapsed}
          />
          <NavLink
            href="/marketing"
            label={t("nav.marketing")}
            icon={Target}
            active={isActive("/marketing")}
            collapsed={collapsed}
          />
        </nav>

        <div className="mt-auto border-t border-slate-900">
          {/* Language Switcher */}
          <div className={`p-2 flex ${collapsed ? 'justify-center' : 'justify-end'} border-b border-slate-900/50`}>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              title="Switch Language"
            >
              <Globe className="h-3 w-3" />
              {!collapsed && <span className="font-bold">{language.toUpperCase()}</span>}
            </button>
          </div>

          <SidebarStatus collapsed={collapsed} />
          <div className="p-3">
            <NavLink
              href="/settings"
              label={t("nav.settings")}
              icon={Settings}
              active={isActive("/settings")}
              collapsed={collapsed}
            />
          </div>
        </div>
      </motion.aside>
    </>
  );
}
