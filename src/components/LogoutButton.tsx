'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

interface Props {
  className?: string;
}

export default function LogoutButton({ className }: Props) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Log out
    </Button>
  );
}
