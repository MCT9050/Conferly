"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '../../lib/supabaseClient';

interface QuickStartButtonProps {
  product?: string;
  label: string;
}

export default function QuickStartButton({ product = 'class', label }: QuickStartButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session?.user) {
        router.push(`/auth?product=${product}`);
        return;
      }
      // Generate room ID and redirect
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      const segments = [];
      for (let i = 0; i < 3; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
          segment += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(segment);
      }
      router.push(`/${product}/classrooms/${segments.join('-')}`);
    } catch {
      router.push(`/auth?product=${product}`);
    }
  }, [product, router]);

  return (
    <button
      onClick={handleClick}
      className="group px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-[15px] flex items-center gap-2.5 shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300"
    >
      {label}
    </button>
  );
}