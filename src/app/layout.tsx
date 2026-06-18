import type { ReactNode } from 'react';
import { Providers } from './providers';
import AmbientBackground from '@/components/AmbientBackground';
import './globals.css';

export const metadata = { title: 'QuestTracker' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">
        <AmbientBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
