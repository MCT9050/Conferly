'use client';

export {
  default,
  cleanupRemoteAudioRegistry,
  collectRemoteMicrophonePublications,
  createRemoteAudioRegistry,
  reconcileRemoteAudioElements,
} from '@/components/meeting/RemoteAudioRenderer';
export type {
  RemoteAudioElementLike,
  RemoteAudioRegistry,
  RemoteAudioTrackReference,
  RemoteTrackPublicationLike,
  RoomLike,
} from '@/components/meeting/RemoteAudioRenderer';