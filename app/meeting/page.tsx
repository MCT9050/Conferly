import dynamic from 'next/dynamic';
import MeetingShell from '../../components/meeting/MeetingShell';
import MeetingRuntimeFallback from '../../components/meeting/MeetingRuntimeFallback';

const MeetingRuntimeClient = dynamic(
  () => import('../../components/meeting/MeetingRuntimeClient'),
  { loading: () => <MeetingRuntimeFallback /> }
);

interface MeetingPageProps {
  searchParams?: Promise<{ room?: string }>;
}

export default async function MeetingPage({ searchParams }: MeetingPageProps) {
  const params = await searchParams;
  const roomId = params?.room || '—';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <MeetingShell roomId={roomId} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <MeetingRuntimeClient />
      </div>
    </main>
  );
}