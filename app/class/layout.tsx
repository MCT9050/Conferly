// app/(class)/layout.tsx
// Class product layout: green theme, class-specific navigation.

import { ReactNode } from 'react';
import ClassShell from '@/components/class/ClassShell';

export default function ClassLayout({ children }: { children: ReactNode }) {
  return <ClassShell>{children}</ClassShell>;
}