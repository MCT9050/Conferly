// app/rooms/page.tsx
// Rooms listing page — redirects to Meet dashboard where rooms are managed

import { redirect } from 'next/navigation';

export default function RoomsPage() {
  redirect('/meet/dashboard');
}
