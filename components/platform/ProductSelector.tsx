'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, BookOpen, Clock } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export type RecentActivityItem = { id: string; title: string; type: 'meeting' | 'classroom'; created_at: string };

type ProductSelectorProps = { user: User | null; recentActivity?: RecentActivityItem[] };

function timeAgo(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export function ProductSelector({ user, recentActivity = [] }: ProductSelectorProps) {
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState<'meet' | 'class' | null>(null);
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Welcome back, {displayName}</h1>
        <p className="text-muted-foreground mb-8">Choose your workspace</p>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <button
            type="button"
            onMouseEnter={() => setHoveredCard('meet')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => router.push('/meet/dashboard')}
            className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all ${
              hoveredCard === 'meet' ? 'border-blue-500/50 bg-blue-950/30 shadow-lg shadow-blue-900/20' : 'border-white/10 bg-slate-900/40 hover:border-blue-500/30'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`p-3 rounded-xl ${hoveredCard === 'meet' ? 'bg-blue-600' : 'bg-blue-600/80'} transition-colors`}>
                <Video className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">Conferly Meet</h2>
            <p className="text-sm text-slate-400 mb-4">Professional video calls</p>
            <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              hoveredCard === 'meet' ? 'bg-blue-600 text-white' : 'bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30'
            }`}>
              Enter
            </span>
          </button>

          <button
            type="button"
            onMouseEnter={() => setHoveredCard('class')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => router.push('/class/dashboard')}
            className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all ${
              hoveredCard === 'class' ? 'border-emerald-500/50 bg-emerald-950/30 shadow-lg shadow-emerald-900/20' : 'border-white/10 bg-slate-900/40 hover:border-emerald-500/30'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`p-3 rounded-xl ${hoveredCard === 'class' ? 'bg-emerald-600' : 'bg-emerald-600/80'} transition-colors`}>
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">New</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">Conferly Class</h2>
            <p className="text-sm text-slate-400 mb-4">Teaching & learning</p>
            <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              hoveredCard === 'class' ? 'bg-emerald-600 text-white' : 'bg-emerald-600/20 text-emerald-400 group-hover:bg-emerald-600/30'
            }`}>
              Enter
            </span>
          </button>
        </div>
      </div>

      {recentActivity.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h3>
          </div>
          <div className="space-y-2 max-w-2xl">
            {recentActivity.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => router.push(item.type === 'meeting' ? `/meet/rooms/${item.id}` : `/class/classrooms/${item.id}`)}
                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/30 px-4 py-3 text-left hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-2 w-2 rounded-full ${item.type === 'meeting' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  <span className="text-sm text-slate-200">{item.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}