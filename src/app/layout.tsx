import type { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCosmetic } from '@/lib/cosmetics';
import { Providers } from './providers';
import BackgroundLayer from '@/components/BackgroundLayer';
import SettingsButton from '@/components/SettingsButton';
import './globals.css';

export const metadata = { title: 'QuestTracker' };

/**
 * The signed-in user's equipped theme (applied as data-theme to avoid FOUC) and
 * background cosmetic id, plus whether anyone is signed in. Resolved server-side
 * in one query.
 */
async function activeCosmetics(): Promise<{
  signedIn: boolean;
  themeAttr?: string;
  backgroundId: string | null;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { signedIn: false, backgroundId: null };
  const user = await prisma.user
    .findUnique({ where: { id: session.user.id }, select: { themeId: true, backgroundId: true } })
    .catch(() => null);
  return {
    signedIn: true,
    themeAttr: user?.themeId ? getCosmetic(user.themeId)?.themeAttr : undefined,
    backgroundId: user?.backgroundId ?? null,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { signedIn, themeAttr, backgroundId } = await activeCosmetics();
  return (
    <html lang="en" className="dark" data-theme={themeAttr}>
      <body className="min-h-screen font-sans">
        <BackgroundLayer backgroundId={backgroundId} />
        {signedIn && <SettingsButton />}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
