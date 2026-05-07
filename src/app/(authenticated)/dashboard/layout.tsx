import { Montserrat } from 'next/font/google';

// Self-hosted Montserrat with Vietnamese subset.
// Loaded only for the /dashboard route — other routes keep using Geist.
// `display: 'swap'` shows fallback text immediately, then swaps in Montserrat
// once it loads — avoids invisible-text flash (FOIT).
const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={montserrat.className}>{children}</div>;
}
