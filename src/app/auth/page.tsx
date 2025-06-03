
"use client";
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function AuthPage() {
  const { currentUser, loading: authLoading, signInAsGuest } = useAuth();
  const router = useRouter();
  const [guestLoading, setGuestLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && currentUser) {
      router.push('/chat');
    }
  }, [currentUser, authLoading, router]);

  if (authLoading || currentUser) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const handleGuestSignIn = async () => {
    setGuestLoading(true);
    try {
      await signInAsGuest();
      toast({ title: 'Signed In as Guest', description: 'Welcome to Wicker!' });
      router.push('/chat');
    } catch (error: any) {
      toast({
        title: 'Guest Sign In Failed',
        description: error.message || 'Could not sign in as guest.',
        variant: 'destructive',
      });
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-card/80 p-4">
      <Card className="w-full max-w-md shadow-2xl bg-card border-border">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="https://i.imgur.com/qRm5rG3.png" alt="Wicker Logo" width={80} height={80} className="rounded-full" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary font-headline">Wicker</CardTitle>
          <CardDescription className="text-muted-foreground">Secure & Ephemeral Messaging</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-input text-muted-foreground">
              <TabsTrigger value="signin" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="pt-6">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="pt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Or</p>
            <Button variant="outline" className="w-full border-primary/50 hover:bg-primary/10 text-primary" onClick={handleGuestSignIn} disabled={guestLoading}>
              {guestLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue as Guest
            </Button>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Note: If you forget your password, account recovery is not possible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
