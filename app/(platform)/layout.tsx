// app/(platform)/layout.tsx
// Minimal shared shell for the platform — only global nav + auth shell.
// Product-specific chrome (theme, sidebar, nav) lives in (meet) and (class).

import { ReactNode } from 'react';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Shared TopNav (logo, avatar, billing) */}
      {children}
    </div>
  );
}