// components/class/ClassShell.tsx
// Green-themed layout wrapper for Conferly Class product.

import { ReactNode } from 'react';

type ClassShellProps = { children: ReactNode };

export default function ClassShell({ children }: ClassShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Class-specific chrome: green theme, class navigation */}
      <div className="border-b border-emerald-500/10 bg-slate-950/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold tracking-tight">Conferly Class</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wider text-emerald-400/80">Teaching & learning</span>
          </nav>
        </div>
      </div>
      <main className="container mx-auto py-6">{children}</main>
    </div>
  );
}