"use client";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900 p-2">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-end">
        <button
          onClick={() => typeof window !== "undefined" && window.location.reload()}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
          aria-label="Recargar interfaz"
          title="Recargar interfaz"
        >
          Recargar UI
        </button>
      </div>
    </footer>
  );
}

