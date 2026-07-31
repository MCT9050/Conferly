"use client";

import { useCallback, useEffect, useRef } from "react";

type TrackLike = {
  attach?: (element?: HTMLMediaElement) => HTMLMediaElement | MediaStream | MediaStreamTrack | void;
  detach?: (element?: HTMLMediaElement) => HTMLMediaElement[] | void;
  mediaStreamTrack?: MediaStreamTrack;
};

export type RemoteTrackPublicationLike = {
  trackSid?: string;
  sid?: string;
  kind?: string;
  source?: string;
  isSubscribed?: boolean;
  isMuted?: boolean;
  track?: TrackLike | null;
  audioTrack?: TrackLike | null;
};

type ParticipantLike = {
  sid?: string;
  identity?: string;
  isLocal?: boolean;
  trackPublications?: Map<string, RemoteTrackPublicationLike>;
  getTrackPublications?: () => Map<string, RemoteTrackPublicationLike>;
};

type RoomLike = {
  localParticipant?: ParticipantLike | Record<string, unknown> | null;
  remoteParticipants?: Map<string, ParticipantLike>;
  participants?: Map<string, ParticipantLike>;
  startAudio?: () => Promise<void>;
};

export type RemoteAudioTrackReference = {
  participantId: string;
  participantName: string;
  publicationId: string;
  publication: RemoteTrackPublicationLike;
};

export type RemoteAudioElementLike = {
  autoplay: boolean;
  srcObject: MediaProvider | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  play?: () => Promise<void> | void;
  pause: () => void;
  remove: () => void;
};

export type RemoteAudioRegistry = {
  audioElements: Map<string, RemoteAudioElementLike>;
  attachedTracks: Map<string, TrackLike | null>;
};

type ReconcileRemoteAudioElementsOptions = {
  entries: RemoteAudioTrackReference[];
  registry: RemoteAudioRegistry;
  createAudioElement: () => RemoteAudioElementLike;
  appendAudioElement: (element: RemoteAudioElementLike) => void;
  onPlaybackFailure: (message: string) => void;
};

const MICROPHONE_SOURCES = new Set(["microphone", "mic"]);

function getParticipantId(participant: ParticipantLike) {
  return participant.identity ?? participant.sid ?? "remote-participant";
}

function getPublicationMap(participant: ParticipantLike): Map<string, RemoteTrackPublicationLike> {
  if (participant.trackPublications instanceof Map) {
    return participant.trackPublications;
  }

  if (typeof participant.getTrackPublications === "function") {
    return participant.getTrackPublications();
  }

  return new Map();
}

function isRemoteMicrophonePublication(publication: RemoteTrackPublicationLike | undefined | null) {
  if (!publication || publication.isSubscribed === false) {
    return false;
  }

  const kind = publication.kind?.toLowerCase();
  const source = publication.source?.toLowerCase();

  return kind === "audio" && Boolean(source && MICROPHONE_SOURCES.has(source));
}

function getPublicationId(publication: RemoteTrackPublicationLike, fallback: string) {
  return publication.trackSid ?? publication.sid ?? fallback;
}

function getAttachedTrack(publication: RemoteTrackPublicationLike) {
  return publication.audioTrack ?? publication.track ?? null;
}

function getPlaybackFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown autoplay failure";
}

export function createRemoteAudioRegistry(): RemoteAudioRegistry {
  return {
    audioElements: new Map<string, RemoteAudioElementLike>(),
    attachedTracks: new Map<string, TrackLike | null>(),
  };
}

export function collectRemoteMicrophonePublications(room: RoomLike | null | undefined) {
  if (!room) {
    return [] as RemoteAudioTrackReference[];
  }

  const participants = room.remoteParticipants ?? room.participants ?? new Map<string, ParticipantLike>();
  const entries: RemoteAudioTrackReference[] = [];

  participants.forEach((participant) => {
    if (!participant || participant.isLocal) {
      return;
    }

    const participantId = getParticipantId(participant);
    getPublicationMap(participant).forEach((publication, key) => {
      if (!isRemoteMicrophonePublication(publication)) {
        return;
      }

      entries.push({
        participantId,
        participantName: participant.identity ?? participant.sid ?? "Guest",
        publicationId: getPublicationId(publication, `${participantId}:${key}`),
        publication,
      });
    });
  });

  return entries;
}

function removeAudioEntry(publicationId: string, registry: RemoteAudioRegistry) {
  const previousTrack = registry.attachedTracks.get(publicationId);
  const audio = registry.audioElements.get(publicationId);

  previousTrack?.detach?.(audio as HTMLMediaElement | undefined);
  registry.attachedTracks.delete(publicationId);

  if (!audio) {
    return;
  }

  audio.pause();
  audio.srcObject = null;
  audio.removeAttribute("src");
  audio.remove();
  registry.audioElements.delete(publicationId);
}

export function reconcileRemoteAudioElements({
  entries,
  registry,
  createAudioElement,
  appendAudioElement,
  onPlaybackFailure,
}: ReconcileRemoteAudioElementsOptions) {
  const nextIds = new Set(entries.map((entry) => entry.publicationId));

  for (const publicationId of Array.from(registry.audioElements.keys())) {
    if (!nextIds.has(publicationId)) {
      removeAudioEntry(publicationId, registry);
    }
  }

  entries.forEach(({ participantId, publicationId, publication }) => {
    const nextTrack = getAttachedTrack(publication);
    if (!nextTrack) {
      removeAudioEntry(publicationId, registry);
      return;
    }

    let audio = registry.audioElements.get(publicationId);
    const previousTrack = registry.attachedTracks.get(publicationId) ?? null;

    if (!audio) {
      audio = createAudioElement();
      audio.autoplay = true;
      audio.setAttribute("data-remote-audio-id", publicationId);
      audio.setAttribute("data-remote-participant-id", participantId);
      audio.setAttribute("playsinline", "true");
      appendAudioElement(audio);
      registry.audioElements.set(publicationId, audio);
    }

    if (previousTrack !== nextTrack) {
      previousTrack?.detach?.(audio as HTMLMediaElement | undefined);
      nextTrack.attach?.(audio as HTMLMediaElement);
      registry.attachedTracks.set(publicationId, nextTrack);
    }

    const playPromise = audio.play?.();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error: unknown) => {
        onPlaybackFailure(getPlaybackFailureMessage(error));
      });
    }
  });
}

export function cleanupRemoteAudioRegistry(registry: RemoteAudioRegistry) {
  for (const publicationId of Array.from(registry.audioElements.keys())) {
    removeAudioEntry(publicationId, registry);
  }
}

type RemoteAudioRendererProps = {
  room: RoomLike | null;
  tracks: RemoteAudioTrackReference[];
  playbackBlocked: boolean;
  onPlaybackBlocked: (message: string) => void;
  onPlaybackRecovered: () => void;
  onPlaybackFailure?: (message: string) => void;
};

export default function RemoteAudioRenderer({
  room,
  tracks,
  playbackBlocked,
  onPlaybackBlocked,
  onPlaybackRecovered,
  onPlaybackFailure,
}: RemoteAudioRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registryRef = useRef(createRemoteAudioRegistry());

  const handlePlaybackFailure = useCallback(
    (message: string) => {
      console.error("Remote audio playback failed", message);
      onPlaybackBlocked(message);
      onPlaybackFailure?.(message);
    },
    [onPlaybackBlocked, onPlaybackFailure],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    reconcileRemoteAudioElements({
      entries: tracks,
      registry: registryRef.current,
      createAudioElement: () => document.createElement("audio"),
      appendAudioElement: (element) => {
        container.appendChild(element as HTMLAudioElement);
      },
      onPlaybackFailure: handlePlaybackFailure,
    });
  }, [handlePlaybackFailure, tracks]);

  useEffect(() => {
    return () => {
      cleanupRemoteAudioRegistry(registryRef.current);
    };
  }, []);

  const enableSound = useCallback(async () => {
    if (!room?.startAudio) {
      onPlaybackBlocked("LiveKit room audio recovery is unavailable");
      return;
    }

    try {
      await room.startAudio();
      onPlaybackRecovered();
    } catch (error) {
      handlePlaybackFailure(getPlaybackFailureMessage(error));
    }
  }, [handlePlaybackFailure, onPlaybackBlocked, onPlaybackRecovered, room]);

  return (
    <div aria-live="polite">
      <div ref={containerRef} data-testid="remote-audio-renderer" className="hidden" />
      {playbackBlocked && (
        <button
          type="button"
          data-testid="enable-remote-audio"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          onClick={() => {
            void enableSound();
          }}
        >
          Enable sound
        </button>
      )}
    </div>
  );
}