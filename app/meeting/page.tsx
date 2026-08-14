// app/meeting/page.tsx
// DEPRECATED ROUTE — Redirects to new domain-specific paths

import { redirect } from 'next/navigation';

interface MeetingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MeetingPage({ searchParams }: MeetingPageProps) {
  const resolvedSearchParams = await searchParams;
  const slug = resolvedSearchParams.slug as string | undefined;
  const type = resolvedSearchParams.type as string | undefined;

  if (!slug) {
    redirect('/dashboard');
  }

  if (type === 'classroom') {
    redirect(`/class/classrooms/${slug}`);
  }

  redirect(`/meet/rooms/${slug}`);
}
