"use client";
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';

export default function HomePage() {
  const { wickerUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (wickerUser) {
        router.replace('/chat');
      } else {
        router.replace('/auth');
      }
    }
  }, [wickerUser, loading, router]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background space-y-6">
      <Image src="https://i.imgur.com/qRm5rG3.png" alt="Wicker Logo" width={160} height={160} priority />
      <div className="flex items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-xl text-foreground">Loading Wicker...</p>
      </div>
    </div>
  );
}
