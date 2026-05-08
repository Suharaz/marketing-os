import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in — Marketing OS' };

export default async function LoginPage() {
  // Already authenticated → go to dashboard
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-white px-6">
      {/* Subtle grid pattern in the background — Linear-style ambience.
          Pointer-events disabled so it never intercepts focus on the form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <LoginForm />

      <footer className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-zinc-400">
        Marketing OS · v1.0
      </footer>
    </main>
  );
}
