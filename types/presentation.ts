import type {
  RemoteAudioTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
} from "livekit-client";

export type PresentationStatus =
  | "idle"
  | "requesting"
  | "previewing"
  | "publishing"
  | "active"
  | "stopping"
  | "failed";

export type RemotePresentation = {
  id: string;
  participantIdentity: string;
  participantName: string;
  publicationSid: string;
  startedAt: number;
  videoTrack: RemoteVideoTrack | null;
  videoPublication: RemoteTrackPublication | null;
  audioTrack: RemoteAudioTrack | null;
  audioPublication: RemoteTrackPublication | null;
};

export function createPresentationId(participantIdentity: string): string {
  return `presentation-${participantIdentity}`;
}