import { redirect } from 'next/navigation';

// Ensure this page runs at request time so `searchParams` are available
export const dynamic = 'force-dynamic';

export default function SigninRedirectPage({ searchParams }: { searchParams?: { redirect?: string }}) {
  const redirectParam = searchParams?.redirect ? `?redirect=${encodeURIComponent(searchParams.redirect)}` : '';
  redirect(`/auth${redirectParam}`);
}
