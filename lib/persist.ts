export type StoredMeeting = {
  id: string;
  title: string;
  participantCount: number;
  duration: number;
  startedAt: string;
  roomCode: string;
};

export type ActiveSession = {
  id: string;
  roomId: string;
  roomCode: string;
  startedAt: string;
  durationAtPause: number;
};
