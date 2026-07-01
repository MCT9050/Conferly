"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from './roomHelpers';

export default function CreateMeetingButton() {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(`/lobby?room=${generateRoomId()}`);
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
    >
      New Meeting
    </button>
  );
}