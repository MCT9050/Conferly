import dynamic from 'next/dynamic';
import Logo from '../../components/Logo';
import MeetingShell from '../../components/meeting/MeetingShell';
import MeetingRuntimeFallback from '../../components/meeting/MeetingRuntimeFallback';

const MeetingRuntimeClient = dynamic(
  () => import('../../components/meeting/MeetingRuntimeClient'),
  { loading: () => <MeetingRuntimeFallback /> }
);

export default function MeetingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <MeetingShell />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <MeetingRuntimeClient />
      </div>
    </main>
  );
}
