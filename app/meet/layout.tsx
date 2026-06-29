// app/(meet)/layout.tsx
// Meet product layout: blue theme, meet-specific navigation.

import { ReactNode } from 'react';
import MeetShell from '@/components/meet/MeetShell';

export default function MeetLayout({ children }: { children: ReactNode }) {
  return <MeetShell>{children}</MeetShell>;
}