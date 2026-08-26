// app/meet/dashboard/page.tsx
// Legacy Meet dashboard stub. The real cross-product workspace (recent
// meetings + classrooms) lives at /dashboard; this path remains reachable from
// older links (LandingPageClient, ProductSelector, recentWorkspace), so it
// redirects instead of rendering a dead-end placeholder.

import { redirect } from 'next/navigation';

export default async function MeetDashboardPage() {
  redirect('/dashboard');
}

