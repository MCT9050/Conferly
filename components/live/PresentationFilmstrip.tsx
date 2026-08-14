'use client';

import type { LiveRoomParticipant, PersonalLayout } from '@/lib/liveRoomSeating';
import { LiveVideoTile } from './LiveVideoTile';

export function PresentationFilmstrip({ participants, layout = 'filmstrip', visible = true }: { participants: LiveRoomParticipant[]; layout?: PersonalLayout; visible?: boolean }) {
  if (!visible || participants.length === 0) return null;
  return (
    <aside aria-label="Participant filmstrip" className="flex gap-3 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 p-3" data-live-room-filmstrip>
      {participants.map((p) => (
        <div key={p.identity} className="w-44 shrink-0">
          <LiveVideoTile participant={p} layout={layout} compact />
        </div>
      ))}
    </aside>
  );
}