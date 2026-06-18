import type { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCosmetic } from '@/lib/cosmetics';
import { Providers } from './providers';
import AmbientBackground from '@/components/AmbientBackground';
import './globals.css';

export const metadata = { title: 'QuestTracker' };

/** The signed-in user's equipped color theme, applied as data-theme to avoid FOUC. */
async function activeThemeAttr(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return undefined;
  const user = await prisma.user
    .findUnique({ where: { id: session.user.id }, select: { themeId: true } })
    .catch(() => null);
  if (!user?.themeId) return undefined;
  return getCosmetic(user.themeId)?.themeAttr;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await activeThemeAttr();
  return (
    <html lang="en" className="dark" data-theme={theme}>
      <body className="min-h-screen font-sans">
        <AmbientBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
