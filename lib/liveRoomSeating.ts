export type LiveRoomRole = 'owner' | 'moderator' | 'presenter' | 'participant' | 'spectator';
export type LiveRoomActivity = 'welcome' | 'gallery' | 'focus' | 'discussion' | 'screen-share' | 'presentation' | 'whiteboard';
export type PersonalLayout = 'comfortable' | 'standard' | 'compact' | 'paginated' | 'filmstrip' | 'audio-only';
export type ParticipantDensity = 'comfortable' | 'standard' | 'compact' | 'paginated';
export type ViewportSize = 'mobile' | 'tablet' | 'desktop';
export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';

export interface LiveRoomParticipant {
  id: string;
  identity: string;
  name: string;
  avatar?: string;
  role: LiveRoomRole;
  cameraStream: MediaStream | null;
  microphonePublication?: { isMuted?: boolean; muted?: boolean; isSubscribed?: boolean } | null;
  screenShareStream: MediaStream | null;
  isLocal: boolean;
  isSpeaking: boolean;
  connectionQuality?: ConnectionQuality;
}

export function classifyViewport(width: number): ViewportSize {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function selectDensity(participantCount: number, moderatorCount: number, viewport: ViewportSize): ParticipantDensity {
  if (viewport === 'mobile') return 'paginated';
  const audienceCount = Math.max(0, participantCount - moderatorCount);
  if (audienceCount <= 10) return 'comfortable';
  if (audienceCount <= 20) return 'standard';
  return 'compact';
}

export function selectPageSize(viewport: ViewportSize, density: ParticipantDensity): number {
  if (viewport === 'mobile') return density === 'compact' ? 6 : 4;
  if (viewport === 'tablet') return density === 'comfortable' ? 6 : density === 'standard' ? 9 : 12;
  if (density === 'comfortable') return 12;
  if (density === 'standard') return 20;
  if (density === 'compact') return 32;
  return 12;
}

export function paginateParticipants<T>(participants: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(participants.length / safePageSize));
  const currentPage = Math.min(Math.max(0, page), pageCount - 1);
  const start = currentPage * safePageSize;
  return { pageItems: participants.slice(start, start + safePageSize), currentPage, pageCount };
}

const roleRank: Record<LiveRoomRole, number> = { owner: 0, moderator: 1, presenter: 2, participant: 3, spectator: 4 };

export function stableParticipantIdentity(participant: { identity?: string; id?: string; name?: string }): string {
  return participant.identity || participant.id || participant.name || 'participant';
}

export function orderParticipants<T extends Pick<LiveRoomParticipant, 'identity' | 'name' | 'role' | 'isLocal' | 'isSpeaking'>>(participants: T[]): T[] {
  return [...participants].sort((a, b) => {
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
    const roleDelta = roleRank[a.role] - roleRank[b.role];
    if (roleDelta !== 0) return roleDelta;
    return stableParticipantIdentity(a).localeCompare(stableParticipantIdentity(b));
  });
}

export function findActiveScreenShare<T extends Pick<LiveRoomParticipant, 'screenShareStream'>>(participants: T[]): T | null {
  return participants.find((p) => p.screenShareStream !== null) ?? null;
}

export function partitionStageAndFilmstrip<T extends LiveRoomParticipant>(participants: T[], activity: LiveRoomActivity, selectedIdentity?: string | null) {
  const activeScreenShare = findActiveScreenShare(participants);
  const selected = selectedIdentity ? participants.find((p) => p.identity === selectedIdentity || p.id === selectedIdentity) ?? null : null;
  const stage = activity === 'screen-share'
    ? activeScreenShare
    : selected ?? participants.find((p) => p.isSpeaking) ?? participants.find((p) => p.role === 'owner' || p.role === 'presenter' || p.role === 'moderator') ?? participants[0] ?? null;
  return { stage, filmstrip: stage ? participants.filter((p) => p.identity !== stage.identity) : participants };
}

export function shouldShowTileVideo(stream: MediaStream | null, videoEnabled: boolean, layout: PersonalLayout): boolean {
  if (layout === 'audio-only') return false;
  if (!stream || !videoEnabled) return false;
  return stream.getVideoTracks().some((track) => track.readyState === 'live');
}

export function selectLocalLayout(preferred: PersonalLayout | null | undefined, viewport: ViewportSize, density: ParticipantDensity): PersonalLayout {
  if (preferred) return preferred;
  if (viewport === 'mobile') return 'paginated';
  return density;
}

export function selectActivityForMedia(current: LiveRoomActivity, hasActiveScreenShare: boolean, previous: LiveRoomActivity = 'gallery'): LiveRoomActivity {
  if (hasActiveScreenShare) return 'screen-share';
  if (current === 'screen-share') return previous === 'screen-share' || previous === 'welcome' ? 'gallery' : previous;
  return current === 'welcome' ? 'gallery' : current;
}