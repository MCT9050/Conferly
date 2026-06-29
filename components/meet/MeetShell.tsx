// components/meet/MeetShell.tsx
// Blue-themed layout wrapper for Conferly Meet product.

import { ReactNode } from 'react';

type MeetShellProps = { children: ReactNode };

export default function MeetShell({ children }: MeetShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Meet-specific chrome: blue theme, meet navigation */}
      <div className="border-b border-blue-500/10 bg-slate-950/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-semibold tracking-tight">Conferly Meet</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wider text-blue-400/80">Professional video calls</span>
          </nav>
        </div>
      </div>
      <main className="container mx-auto py-6">{children}</main>
    </div>
  );
}