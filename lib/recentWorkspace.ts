export type RecentWorkspaceItem = {
  resourceId: string;
  routeSlug: string | null;
  title: string;
  displayLabel: string;
  type: 'meet' | 'classroom';
  createdAt?: string;
};

export function getRecentWorkspaceHref(item: RecentWorkspaceItem): string {
  if (item.type === 'classroom') {
    return `/class/classrooms/${item.resourceId}`;
  }

  if (item.routeSlug?.trim()) {
    return `/meet/rooms/${encodeURIComponent(item.routeSlug.trim())}`;
  }

  return '/meet/dashboard';
}