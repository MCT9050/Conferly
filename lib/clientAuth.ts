// lib/clientAuth.ts
export async function signOut() {
  try {
    await fetch('/api/auth/signout', { method: 'POST' });
  } finally {
    // Redirect to auth page to clear client state
    window.location.href = '/auth';
  }
}

export async function refreshSession() {
  const resp = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!resp.ok) throw new Error('Refresh failed');
  return resp.json();
}
