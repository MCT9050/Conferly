// app/meeting/page.tsx
// DEPRECATED ROUTE — Redirects to new domain-specific paths

import { redirect } from 'next/navigation';
import type { NextPage } from 'next';

interface MeetingPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

const MeetingPage: NextPage<MeetingPageProps> = ({ searchParams }) => {
  const slug = searchParams?.slug as string | undefined;
  const type = searchParams?.type as string | undefined;

  if (!slug) {
    redirect('/dashboard');
  }

  if (type === 'classroom') {
    redirect(`/class/classrooms/${slug}`);
  }

  redirect(`/meet/rooms/${slug}`);
};

export default MeetingPage;

