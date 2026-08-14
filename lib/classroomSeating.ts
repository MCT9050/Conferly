import type { ClassroomRole, ClassroomParticipant, ClassroomMode } from '@/types';
import type { LiveRoomParticipant, LiveRoomRole, ParticipantDensity, PersonalLayout, ViewportSize } from '@/lib/liveRoomSeating';
import { classifyViewport, findActiveScreenShare as findLiveRoomScreenShare, orderParticipants, selectDensity, shouldShowTileVideo } from '@/lib/liveRoomSeating';

export type { ParticipantDensity, PersonalLayout, ViewportSize } from '@/lib/liveRoomSeating';
export { classifyViewport, orderParticipants, paginateParticipants, partitionStageAndFilmstrip, selectActivityForMedia, selectDensity, selectLocalLayout, selectPageSize, shouldShowTileVideo, stableParticipantIdentity } from '@/lib/liveRoomSeating';

export function isTeacherRole(role: ClassroomRole | null | undefined): boolean {
  return role === 'owner' || role === 'instructor' || role === 'ta';
}

export function isStudentRole(role: ClassroomRole | null | undefined): boolean {
  return role === 'student';
}

export function isAuditorRole(role: ClassroomRole | null | undefined): boolean {
  return role === 'auditor';
}

export function canPublishClassroomMedia(role: ClassroomRole | null | undefined): boolean {
  return Boolean(role) && role !== 'auditor';
}

export function canUseClassroomTeacherControls(role: ClassroomRole | null | undefined): boolean {
  return isTeacherRole(role);
}

export function canUseClassroomWhiteboard(role: ClassroomRole | null | undefined): boolean {
  return isTeacherRole(role);
}

export function mapClassroomRoleToLiveRoomRole(role: ClassroomRole | null | undefined): LiveRoomRole {
  if (role === 'owner') return 'owner';
  if (role === 'instructor' || role === 'ta') return 'moderator';
  if (role === 'auditor' || !role) return 'spectator';
  return 'participant';
}

export function classifyRole(raw: unknown): ClassroomRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.toLowerCase().trim();
  if (['owner', 'instructor', 'ta', 'student', 'auditor'].includes(normalized)) return normalized as ClassroomRole;
  return null;
}

export function selectDefaultDensity(participantCount: number, teacherCount: number, viewport: ViewportSize): ParticipantDensity {
  return selectDensity(participantCount, teacherCount, viewport);
}

export function selectDefaultLayout(participantCount: number, viewport: ViewportSize): 'standard' | 'paginated' | 'filmstrip' {
  if (viewport === 'mobile') return 'paginated';
  if (participantCount <= 15) return 'standard';
  return 'filmstrip';
}

export function getViewportSize(): ViewportSize {
  return typeof window === 'undefined' ? 'desktop' : classifyViewport(window.innerWidth);
}

export function toLiveRoomParticipant(participant: ClassroomParticipant, localUserId?: string): LiveRoomParticipant {
  return {
    id: participant.id,
    identity: participant.id,
    name: participant.name,
    avatar: participant.avatar,
    role: mapClassroomRoleToLiveRoomRole(participant.role),
    cameraStream: participant.stream,
    microphonePublication: { isMuted: participant.isMuted },
    screenShareStream: participant.screenShareStream,
    isLocal: participant.id === localUserId,
    isSpeaking: participant.isSpeaking,
  };
}

export function sortParticipants(participants: ClassroomParticipant[], localUserId?: string): ClassroomParticipant[] {
  const sortedIds = orderParticipants(participants.map((p) => toLiveRoomParticipant(p, localUserId))).map((p) => p.id);
  return sortedIds.map((id) => participants.find((p) => p.id === id)).filter((p): p is ClassroomParticipant => Boolean(p));
}

export function partitionParticipants(participants: ClassroomParticipant[]) {
  const teachers: ClassroomParticipant[] = [];
  const students: ClassroomParticipant[] = [];
  const auditors: ClassroomParticipant[] = [];
  for (const participant of participants) {
    if (isTeacherRole(participant.role)) teachers.push(participant);
    else if (isAuditorRole(participant.role)) auditors.push(participant);
    else students.push(participant);
  }
  return { teachers, students, auditors };
}

export function parseClassroomRoleFromMetadata(metadata: string | undefined): ClassroomRole | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && 'classroomRole' in parsed) return classifyRole(parsed.classroomRole);
  } catch {}
  return classifyRole(metadata);
}

export function createClassroomRoleMetadata(role: ClassroomRole): string {
  return JSON.stringify({ classroomRole: role });
}

export function findActiveScreenShare(participants: ClassroomParticipant[]): ClassroomParticipant | null {
  const active = findLiveRoomScreenShare(participants.map((p) => toLiveRoomParticipant(p)));
  return active ? participants.find((p) => p.id === active.id) ?? null : null;
}

export function shouldRenderVideoTile(stream: MediaStream | null, isVideoOn: boolean, isAudioOnly: boolean): boolean {
  return shouldShowTileVideo(stream, isVideoOn, isAudioOnly ? 'audio-only' : 'standard');
}

export function classroomFallbackActivityAfterScreenShare(previous: ClassroomMode): ClassroomMode {
  return previous === 'whiteboard' ? 'whiteboard' : 'gallery';
}