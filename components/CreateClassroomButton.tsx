"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from './roomHelpers';

export default function CreateClassroomButton() {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/lobby?room=${generateRoomId()}&domain=class`);
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
    >
      Create Classroom
    </button>
  );
}