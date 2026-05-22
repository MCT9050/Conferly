"use client";

import Link from "next/link";
import { useMemo } from "react";
import Logo from "./Logo";

const actions = [
  { label: 'Open lobby', href: '/lobby' },
  { label: 'Start new meeting', href: '/meeting' },
  { label: 'View pricing', href: '/pricing' },
];

export default function ClientDashboard() {
  const stats = useMemo(
    () => [
      { label: 'Meetings hosted', value: '142' },
      { label: 'Active users', value: '28' },
      { label: 'Transcriptions', value: '369' },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size="sm" className="text-white" />
            <p className="mt-3 max-w-2xl text-slate-400">Your central hub for meetings, room access, and translation-enabled collaboration.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {actions.map(action => (
              <Link key={action.href} href={action.href} className="rounded-full bg-slate-800 px-5 py-3 text-sm text-white transition hover:bg-slate-700">
                {action.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl shadow-black/20">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-4 text-slate-400">Conferly is now using route-based pages so each view can be optimized for server rendering or client-only browser logic.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {stats.map(stat => (
                <div key={stat.label} className="rounded-3xl bg-slate-950/80 p-6">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-8">
            <div>
              <h2 className="text-xl font-semibold text-white">Meeting recommendations</h2>
              <p className="mt-3 text-slate-400">Use route-based navigation for better SEO, faster first paint, and clearer App Router semantics.</p>
            </div>
            <div className="rounded-3xl bg-slate-950/80 p-5 text-slate-300">
              <p className="text-sm uppercase tracking-[0.24em] text-amber-400">Next step</p>
              <p className="mt-3">Move heavy browser APIs into focused client-only islands inside the `/meeting` page.</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
