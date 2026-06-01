import { redirect } from 'next/navigation';

// Ensure this page runs at request time so `searchParams` are available
export const dynamic = 'force-dynamic';

export default async function SigninRedirectPage({ searchParams }: { searchParams?: Promise<any> }) {
  const params = (await Promise.resolve(searchParams)) as { redirect?: string } | undefined;
  const redirectParam = params?.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : '';
  redirect(`/auth${redirectParam}`);
}
