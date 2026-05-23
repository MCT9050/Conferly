import { redirect } from 'next/navigation';

export default function SigninRedirectPage({ searchParams }: { searchParams?: { redirect?: string }}) {
  const redirectParam = searchParams?.redirect ? `?redirect=${encodeURIComponent(searchParams.redirect)}` : '';
  redirect(`/auth${redirectParam}`);
}
