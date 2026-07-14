// app/meet/rooms/page.tsx
// Meet rooms listing page — redirects to dashboard to create/manage rooms

import { redirect } from 'next/navigation';

export default function MeetRoomsIndexPage() {
  redirect('/meet/dashboard');
}
