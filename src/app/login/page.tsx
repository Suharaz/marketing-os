import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Login — Marketing OS' };

export default async function LoginPage() {
  // Already authenticated → go to dashboard
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <LoginForm />
    </main>
  );
}
