import { Suspense } from "react";
import MeetingShell from "@/components/meeting/MeetingShell";
import MeetingRuntimeFallback from "@/components/meeting/MeetingRuntimeFallback";
import MeetingRuntimeClient from "@/components/meeting/MeetingRuntimeClient";

interface MeetingPageProps {
  searchParams?: Promise<{ room?: string; type?: string }>;
}

export default async function MeetingPage({ searchParams }: MeetingPageProps) {
  const params = await searchParams;
  const roomId = params?.room || "\u2014";
  const roomType: 'meeting' | 'classroom' = params?.type === 'classroom' ? 'classroom' : 'meeting';
  const participantCap = roomType === "classroom" ? "5 learners" : "16 people";

  return (
    <>
      <MeetingShell roomId={roomId} participantCap={participantCap} />
      <Suspense fallback={<MeetingRuntimeFallback />}>
        <MeetingRuntimeClient roomId={roomId} roomType={roomType} />
      </Suspense>
    </>
  );
}