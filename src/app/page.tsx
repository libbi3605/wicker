
"use client";
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        router.replace('/chat');
      } else {
        router.replace('/auth');
      }
    }
  }, [currentUser, loading, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="ml-4 text-xl text-foreground">Loading WickerSphere...</p>
    </div>
  );
}
