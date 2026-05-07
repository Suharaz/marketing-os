import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserRole } from '@/lib/auth/get-role';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const role = await getUserRole(user.userId);

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <SidebarNav user={user} isAdmin={role === 'admin'} />
      <main className="flex-1 overflow-auto p-6 min-w-0">{children}</main>
    </div>
  );
}
