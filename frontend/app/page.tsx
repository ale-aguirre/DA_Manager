"use client";

export default function DashboardPage() {


  return (
    <div className="mx-auto w-full px-4 md:px-6 lg:px-8">
      <section className="space-y-8">
        <header className="mb-10 mt-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">
            👋 Welcome back, LadyNuggets
          </h1>
          <p className="mt-2 text-lg text-emerald-400 font-medium tracking-wide">
            System Status: Online & Ready
          </p>
        </header>

        {/* Placeholder para futuros widgets */}
        <div className="w-full h-64 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 flex items-center justify-center">
          <p className="text-slate-600 text-sm font-medium">✨ Área libre para widgets futuros</p>
        </div>
      </section>
    </div>
  );
}
