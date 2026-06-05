"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Video, Users, FileText, ArrowRight, LogIn } from "lucide-react";
import Logo from "./Logo";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const stats = useMemo(
    () => [
      { label: "Meetings hosted", value: "142", icon: Video },
      { label: "Active users", value: "28", icon: Users },
      { label: "Transcriptions", value: "369", icon: FileText },
    ],
    [],
  );

  const startMeeting = useCallback(() => {
    const code = generateRoomCode();
    router.push(`/lobby?room=${encodeURIComponent(code)}`);
  }, [router]);

  const joinMeeting = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/lobby?room=${encodeURIComponent(code)}`);
  }, [joinCode, router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        {/* Header */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size="sm" className="text-white" />
            <p className="mt-3 max-w-2xl text-slate-400">
              Your central hub for meetings, room access, and
              translation-enabled collaboration.
            </p>
          </div>
          <Link
            href="/pricing"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            View pricing
          </Link>
        </header>

        {/* Quick actions */}
        <section className="mt-12 grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
          {/* Start / Join card */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl shadow-black/20">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-4 text-slate-400">
              Start a new meeting or join an existing room.
            </p>

            {/* Primary CTA — Start new meeting */}
            <div className="mt-8">
              <button
                type="button"
                onClick={startMeeting}
                className="w-full flex items-center justify-between px-6 py-5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-semibold text-base hover:from-amber-300 hover:to-orange-300 transition-all shadow-lg shadow-amber-400/20 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-950/10 flex items-center justify-center">
                    <Video className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold">Start new meeting</p>
                    <p className="text-sm text-slate-950/60">
                      Create an instant room and invite others
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Join existing meeting */}
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinMeeting();
                    }}
                    placeholder="Enter room code"
                    maxLength={8}
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-800/60 border border-slate-700/30 text-white placeholder-slate-500 font-mono tracking-widest text-center text-sm focus:outline-none focus:border-blue-500/40 uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={joinMeeting}
                  disabled={!joinCode.trim()}
                  className="px-5 py-3.5 rounded-xl bg-slate-700/60 text-white font-medium text-sm flex items-center gap-2 hover:bg-slate-600/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar — quick links */}
          <aside className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-8">
            <div>
              <h2 className="text-xl font-semibold text-white">Quick links</h2>
              <p className="mt-3 text-slate-400 text-sm">
                Manage your account, explore features, and get help.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/pricing"
                className="block rounded-2xl bg-slate-950/80 p-4 hover:bg-slate-800/60 transition-colors"
              >
                <p className="text-sm font-medium text-white">
                  View pricing plans
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Compare trial, pro, and business tiers
                </p>
              </Link>
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm font-medium text-white">
                  Translation settings
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Configure your preferred languages for real-time translation
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm font-medium text-white">
                  Recording & transcription
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Access past meeting recordings and AI-generated summaries
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold">
                Pro tip
              </p>
              <p className="text-sm text-slate-300 mt-2">
                Share a room code with participants to let them join directly
                without creating an account.
              </p>
            </div>
          </aside>
        </section>

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-400">
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {stat.label}
                </p>
                <p className="text-2xl font-semibold text-white mt-1">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}