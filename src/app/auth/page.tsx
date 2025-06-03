
"use client";
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Shield } from 'lucide-react'; // Changed ShieldLock to Shield
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

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
      toast({ title: 'Signed In as Guest', description: 'Welcome to WickerSphere!' });
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" /> {/* Changed ShieldLock to Shield */}
          </div>
          <CardTitle className="text-3xl font-bold text-primary font-headline">WickerSphere</CardTitle>
          <CardDescription>Secure & Ephemeral Messaging</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
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
            <Button variant="outline" className="w-full" onClick={handleGuestSignIn} disabled={guestLoading}>
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
