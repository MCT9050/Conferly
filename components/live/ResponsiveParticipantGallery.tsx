'use client';

import type { LiveRoomParticipant, ParticipantDensity, PersonalLayout, ViewportSize } from '@/lib/liveRoomSeating';
import { orderParticipants, paginateParticipants, selectPageSize } from '@/lib/liveRoomSeating';
import { LiveVideoTile } from './LiveVideoTile';

type ResponsiveParticipantGalleryProps = {
  participants: LiveRoomParticipant[];
  density: ParticipantDensity;
  viewport: ViewportSize;
  layout: PersonalLayout;
  page?: number;
};

export function ResponsiveParticipantGallery({ participants, density, viewport, layout, page = 0 }: ResponsiveParticipantGalleryProps) {
  const ordered = orderParticipants(participants);
  const pageSize = layout === 'paginated' ? selectPageSize(viewport, density) : ordered.length || 1;
  const { pageItems, currentPage, pageCount } = paginateParticipants(ordered, page, pageSize);
  const cols = viewport === 'mobile'
    ? 'grid-cols-1'
    : density === 'comfortable'
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : density === 'standard'
        ? 'grid-cols-2 xl:grid-cols-4'
        : 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-5';

  if (participants.length === 0) {
    return <div className="flex min-h-48 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-sm text-slate-400">No participants yet.</div>;
  }

  return (
    <section aria-label="Participant gallery" className="space-y-2">
      <div className={`grid ${cols} gap-3`} data-live-room-gallery>
        {pageItems.map((p) => <LiveVideoTile key={p.identity} participant={p} layout={layout} compact={density === 'compact'} />)}
      </div>
      {pageCount > 1 && <p className="text-center text-xs text-slate-400">Page {currentPage + 1} of {pageCount}</p>}
    </section>
  );
}