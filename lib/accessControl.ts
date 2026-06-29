import { verifyRoomAccess } from './meetingAuth';
import { verifyClassroomAccess } from './classroomAuth';

export type Domain = 'meet' | 'class';

export type UnifiedAccessResult = {
  granted: boolean;
  role: string;
  roomId: string;
  source: string | null;
  domain: Domain;
};

export async function verifyAccess(
  domain: Domain,
  userId: string,
  roomId: string
): Promise<UnifiedAccessResult> {
  if (domain === 'meet') {
    const result = await verifyRoomAccess(userId, roomId);
    if (!result) {
      return {
        granted: false,
        role: 'spectator',
        roomId,
        source: null,
        domain: 'meet',
      };
    }
    return {
      granted: true,
      role: result.accessRole,
      roomId: result.meetingId ?? roomId,
      source: result.source,
      domain: 'meet',
    };
  }

  const result = await verifyClassroomAccess(userId, roomId);
  return {
    granted: result.granted,
    role: result.accessRole,
    roomId: result.classroomId,
    source: result.source,
    domain: 'class',
  };
}