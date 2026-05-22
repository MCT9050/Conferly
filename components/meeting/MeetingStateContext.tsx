"use client";

import type { ReactNode } from 'react';
import { MeetingMediaProvider } from './state/mediaStore';
import { MeetingParticipantProvider } from './state/participantStore';
import { MeetingTranscriptProvider } from './state/transcriptStore';
import { MeetingPulseProvider } from './state/pulseStore';
import { MeetingChatProvider } from './state/chatStore';
import { MeetingTranslationProvider } from './state/translationStore';
import { MeetingPresentationProvider } from './state/presentationStore';
import { MeetingRecordingProvider } from './state/recordingStore';
import { MeetingSecurityProvider } from './state/securityStore';
import { MeetingRoomProvider } from './state/roomStore';
import { MeetingUiProvider } from './state/uiStore';

export function MeetingStateProvider({ children }: { children: ReactNode }) {
  return (
    <MeetingMediaProvider>
      <MeetingRecordingProvider>
        <MeetingParticipantProvider>
          <MeetingTranscriptProvider>
            <MeetingPulseProvider>
              <MeetingChatProvider>
                <MeetingTranslationProvider>
                  <MeetingPresentationProvider>
                    <MeetingSecurityProvider>
                      <MeetingRoomProvider>
                        <MeetingUiProvider>{children}</MeetingUiProvider>
                      </MeetingRoomProvider>
                    </MeetingSecurityProvider>
                  </MeetingPresentationProvider>
                </MeetingTranslationProvider>
              </MeetingChatProvider>
            </MeetingPulseProvider>
          </MeetingTranscriptProvider>
        </MeetingParticipantProvider>
      </MeetingRecordingProvider>
    </MeetingMediaProvider>
  );
}
