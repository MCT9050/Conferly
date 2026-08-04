import { useCallback, useEffect, useRef, useState } from "react";
import type { Room, RemoteParticipant, RemoteTrack, RemoteTrackPublication, RemoteVideoTrack, RemoteAudioTrack } from "livekit-client";
import { Track, RoomEvent } from "livekit-client";
import type { RemotePresentation } from "../types/presentation";

type UseRemotePresentationsResult = {
  presentations: RemotePresentation[];
  focusedPresentationId: string | null;
  focusedPresentation: RemotePresentation | null;
  setFocusedPresentationId: (id: string | null) => void;
};

function isScreenShareSource(source: Track.Source | undefined): boolean {
  return source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;
}

function isScreenVideoSource(source: Track.Source | undefined): boolean {
  return source === Track.Source.ScreenShare;
}

function isScreenAudioSource(source: Track.Source | undefined): boolean {
  return source === Track.Source.ScreenShareAudio;
}

function scanExistingPresentations(room: Room): Map<string, RemotePresentation> {
  const presentations = new Map<string, RemotePresentation>();

  if (!room.remoteParticipants) {
    return presentations;
  }

  for (const [identity, participant] of room.remoteParticipants) {
    if (!participant.trackPublications) {
      continue;
    }

    for (const [sid, publication] of participant.trackPublications) {
      if (!isScreenShareSource(publication.source)) {
        continue;
      }

      const existingId = `presentation-${identity}`;
      const existing = presentations.get(existingId);

      if (existing) {
        if (isScreenVideoSource(publication.source)) {
          existing.videoPublication = publication;
          existing.publicationSid = publication.trackSid || existing.publicationSid;
        }
        if (isScreenAudioSource(publication.source)) {
          existing.audioPublication = publication;
        }
      } else {
        const presentation: RemotePresentation = {
          id: existingId,
          participantIdentity: identity,
          participantName: participant.name || identity,
          publicationSid: publication.trackSid || sid,
          startedAt: Date.now(),
          videoTrack: null,
          videoPublication: isScreenVideoSource(publication.source) ? publication : null,
          audioTrack: null,
          audioPublication: isScreenAudioSource(publication.source) ? publication : null,
        };
        presentations.set(existingId, presentation);
      }
    }
  }

  return presentations;
}

export function useRemotePresentations(
  room: Room | null
): UseRemotePresentationsResult {
  const [presentations, setPresentations] = useState<RemotePresentation[]>([]);
  const [focusedPresentationId, setFocusedPresentationId] = useState<string | null>(null);

  const presentationsRef = useRef<Map<string, RemotePresentation>>(new Map());
  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  const cleanupListeners = useCallback(() => {
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }
  }, []);

  const updatePresentationsState = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    setPresentations(Array.from(presentationsRef.current.values()));
  }, []);

  const focusFirstActivePresentation = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    const currentFocus = focusedPresentationId;
    const currentFocusExists = currentFocus
      ? presentationsRef.current.has(currentFocus)
      : false;

    if (currentFocusExists) {
      return;
    }

    const firstActive = Array.from(presentationsRef.current.values()).find(
      (p) => p.videoPublication !== null || p.audioPublication !== null
    );

    if (firstActive) {
      setFocusedPresentationId(firstActive.id);
    } else {
      setFocusedPresentationId(null);
    }
  }, [focusedPresentationId]);

  const handleTrackPublished = useCallback(
    (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (!isScreenShareSource(publication.source)) {
        return;
      }

      const identity = participant.identity;
      const existingId = `presentation-${identity}`;
      const existing = presentationsRef.current.get(existingId);

      if (existing) {
        if (isScreenVideoSource(publication.source)) {
          existing.videoPublication = publication;
          existing.publicationSid = publication.trackSid || existing.publicationSid;
        }
        if (isScreenAudioSource(publication.source)) {
          existing.audioPublication = publication;
        }
      } else {
        const presentation: RemotePresentation = {
          id: existingId,
          participantIdentity: identity,
          participantName: participant.name || identity,
          publicationSid: publication.trackSid || existingId,
          startedAt: Date.now(),
          videoTrack: null,
          videoPublication: isScreenVideoSource(publication.source) ? publication : null,
          audioTrack: null,
          audioPublication: isScreenAudioSource(publication.source) ? publication : null,
        };
        presentationsRef.current.set(existingId, presentation);
      }

      updatePresentationsState();
      focusFirstActivePresentation();
    },
    [updatePresentationsState, focusFirstActivePresentation]
  );

  const handleTrackSubscribed = useCallback(
    (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      if (!isScreenShareSource(publication.source)) {
        return;
      }

      const identity = participant.identity;
      const existingId = `presentation-${identity}`;
      const existing = presentationsRef.current.get(existingId);

      if (!existing) {
        return;
      }

      if (isScreenVideoSource(publication.source) && track.kind === Track.Kind.Video) {
        existing.videoTrack = track as RemoteVideoTrack;
      }
      if (isScreenAudioSource(publication.source) && track.kind === Track.Kind.Audio) {
        existing.audioTrack = track as RemoteAudioTrack;
      }

      updatePresentationsState();
      focusFirstActivePresentation();
    },
    [updatePresentationsState, focusFirstActivePresentation]
  );

  const handleTrackUnsubscribed = useCallback(
    (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      if (!isScreenShareSource(publication.source)) {
        return;
      }

      const identity = participant.identity;
      const existingId = `presentation-${identity}`;
      const existing = presentationsRef.current.get(existingId);

      if (!existing) {
        return;
      }

      if (isScreenVideoSource(publication.source) && track.kind === Track.Kind.Video) {
        existing.videoTrack = null;
      }
      if (isScreenAudioSource(publication.source) && track.kind === Track.Kind.Audio) {
        existing.audioTrack = null;
      }

      updatePresentationsState();
    },
    [updatePresentationsState]
  );

  const handleTrackUnpublished = useCallback(
    (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (!isScreenShareSource(publication.source)) {
        return;
      }

      const identity = participant.identity;
      const existingId = `presentation-${identity}`;
      const existing = presentationsRef.current.get(existingId);

      if (!existing) {
        return;
      }

      if (isScreenVideoSource(publication.source)) {
        presentationsRef.current.delete(existingId);
      }
      if (isScreenAudioSource(publication.source)) {
        existing.audioPublication = null;
        existing.audioTrack = null;
      }

      updatePresentationsState();
      focusFirstActivePresentation();
    },
    [updatePresentationsState, focusFirstActivePresentation]
  );

  const handleParticipantDisconnected = useCallback(
    (participant: RemoteParticipant) => {
      const identity = participant.identity;
      const existingId = `presentation-${identity}`;

      if (presentationsRef.current.has(existingId)) {
        presentationsRef.current.delete(existingId);
        updatePresentationsState();
        focusFirstActivePresentation();
      }
    },
    [updatePresentationsState, focusFirstActivePresentation]
  );

  const handleConnected = useCallback(() => {
    if (!roomRef.current) {
      return;
    }

    const scanned = scanExistingPresentations(roomRef.current);
    presentationsRef.current = scanned;
    updatePresentationsState();
    focusFirstActivePresentation();
  }, [updatePresentationsState, focusFirstActivePresentation]);

  const handleReconnected = useCallback(() => {
    handleConnected();
  }, [handleConnected]);

  useEffect(() => {
    mountedRef.current = true;
    roomRef.current = room;

    if (room) {
      const cleanup = () => {
        room.off(RoomEvent.TrackPublished, handleTrackPublished as any);
        room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed as any);
        room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed as any);
        room.off(RoomEvent.TrackUnpublished, handleTrackUnpublished as any);
        room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected as any);
        room.off(RoomEvent.Connected, handleConnected as any);
        room.off(RoomEvent.Reconnected, handleReconnected as any);
      };

      cleanupListeners();

      room.on(RoomEvent.TrackPublished, handleTrackPublished as any);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed as any);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed as any);
      room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished as any);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected as any);
      room.on(RoomEvent.Connected, handleConnected as any);
      room.on(RoomEvent.Reconnected, handleReconnected as any);

      listenerCleanupRef.current = cleanup;

      const scanned = scanExistingPresentations(room);
      presentationsRef.current = scanned;
      updatePresentationsState();
      focusFirstActivePresentation();
    } else {
      cleanupListeners();
      presentationsRef.current = new Map();
      updatePresentationsState();
      setFocusedPresentationId(null);
    }

    return () => {
      mountedRef.current = false;
      cleanupListeners();
      roomRef.current = null;
    };
  }, [
    room,
    cleanupListeners,
    handleTrackPublished,
    handleTrackSubscribed,
    handleTrackUnsubscribed,
    handleTrackUnpublished,
    handleParticipantDisconnected,
    handleConnected,
    handleReconnected,
    updatePresentationsState,
    focusFirstActivePresentation,
  ]);

  const focusedPresentation = focusedPresentationId
    ? presentationsRef.current.get(focusedPresentationId) || null
    : null;

  return {
    presentations,
    focusedPresentationId,
    focusedPresentation,
    setFocusedPresentationId,
  };
}