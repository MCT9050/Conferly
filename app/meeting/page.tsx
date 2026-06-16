import type { Metadata } from "next";
import { Suspense } from "react";
import MeetingShell from "@/components/meeting/MeetingShell";
import MeetingRuntimeFallback from "@/components/meeting/MeetingRuntimeFallback";
import MeetingRuntimeClient from "@/components/meeting/MeetingRuntimeClient";

type SearchParams = { [key: string]: string | string[] | undefined };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const rawType = searchParams.type;
  const roomType = Array.isArray(rawType) ? rawType[0] : rawType ?? "meeting";

  if (roomType === "classroom") {
    return {
      title: "Interactive AI Classroom | Conferly",
      description:
        "Join an integrated tutoring session with collaborative whiteboard and AI assistance.",
      openGraph: {
        title: "Interactive AI Classroom | Conferly",
        description:
          "Join an integrated tutoring session with collaborative whiteboard and AI assistance.",
        url: "https://www.conferly.site/meeting",
        images: [
          {
            url: "/icons/og-classroom.png",
            width: 1200,
            height: 630,
            alt: "Conferly Classroom",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Interactive AI Classroom | Conferly",
        description:
          "Join an integrated tutoring session with collaborative whiteboard and AI assistance.",
        images: ["/icons/og-classroom.png"],
      },
    };
  }

  return {
    title: "Secure Professional Meeting | Conferly",
    description: "Join a high-fidelity business conferencing session.",
    openGraph: {
      title: "Secure Professional Meeting | Conferly",
      description: "Join a high-fidelity business conferencing session.",
      url: "https://www.conferly.site/meeting",
      images: [
        {
          url: "/icons/og-meeting.png",
          width: 1200,
          height: 630,
          alt: "Conferly Meeting",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Secure Professional Meeting | Conferly",
      description: "Join a high-fidelity business conferencing session.",
      images: ["/icons/og-meeting.png"],
    },
  };
}

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