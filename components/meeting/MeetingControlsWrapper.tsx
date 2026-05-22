"use client";

import { useRouter } from 'next/navigation';
import MeetingControls from '../MeetingControls';
import { useMeetingMedia } from './state/mediaStore';
import { useMeetingRecordingState } from './state/recordingStore';
import { useMeetingParticipants } from './state/participantStore';
import { useMeetingUi } from './state/uiStore';
import { useMeetingTranscript } from './state/transcriptStore';

export default function MeetingControlsWrapper() {
  const router = useRouter();
  const media = useMeetingMedia();
  const recording = useMeetingRecordingState();
  const { participants } = useMeetingParticipants();
  const { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, handRaised, toggleHandRaise, reactions, addReaction, meetingDuration } = useMeetingUi();
  const transcriptState = useMeetingTranscript();

  return (
    <MeetingControls
      isMuted={media.isMuted}
      toggleMute={media.toggleMute}
      isVideoOn={media.isVideoOn}
      toggleVideo={media.toggleVideo}
      isScreenSharing={media.isScreenSharing}
      toggleScreenShare={media.toggleScreenShare}
      isRecording={recording.isRecording}
      toggleRecording={() => (recording.isRecording ? recording.stopRecording() : recording.startRecording())}
      recordedBlob={recording.recordedBlob}
      downloadRecording={recording.downloadRecording}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      sidebarTab={sidebarTab}
      setSidebarTab={setSidebarTab}
      onLeave={() => {
        media.stopMedia();
        transcriptState.stopListening();
        router.push('/dashboard');
      }}
      meetingDuration={meetingDuration}
      participantCount={participants.length}
      reactions={reactions}
      addReaction={addReaction}
      handRaised={handRaised}
      toggleHandRaise={toggleHandRaise}
      stopMedia={media.stopMedia}
      stopListening={transcriptState.stopListening}
    />
  );
}
