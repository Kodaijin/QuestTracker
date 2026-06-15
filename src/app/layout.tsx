import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata = { title: 'QuestLog' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
