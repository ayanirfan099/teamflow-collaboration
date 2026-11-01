import type { Metadata } from 'next';
import { ToastProvider } from '@teamflow/ui';
import { QueryClientProvider } from '../components/query-provider';
import { SessionProvider } from '../lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'TeamFlow',
  description: 'Multi-tenant project management for teams that ship.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-ink antialiased">
        <QueryClientProvider>
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
