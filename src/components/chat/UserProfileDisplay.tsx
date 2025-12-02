"use client";
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';

export default function UserProfileDisplay() {
  const { wickerUser, currentUser } = useAuth();
  const { toast } = useToast();

  if (!wickerUser || !currentUser || !wickerUser.user_profile) {
    return null;
  }
  
  const { user_profile } = wickerUser;
  const initials = user_profile.username.substring(0, 2).toUpperCase();

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUser.id)
      .then(() => {
        toast({ title: "UID Copied", description: "Your User ID has been copied to the clipboard." });
      })
      .catch(err => {
        toast({ title: "Copy Failed", description: "Could not copy UID.", variant: "destructive" });
        console.error('Failed to copy UID: ', err);
      });
  };
  
  return (
    <div className="flex flex-col items-start p-1 rounded-lg">
      <div className='flex items-center space-x-3'>
        <Avatar className="h-10 w-10">
          <AvatarImage src={`https://placehold.co/100x100.png?text=${initials}`} alt={user_profile.username} data-ai-hint="abstract avatar" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-md font-semibold text-foreground">{user_profile.username}</h3>
          {currentUser.is_anonymous && <Badge variant="secondary" className="mt-1">Guest</Badge>}
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex items-center">
        <span>ID: {currentUser.id.substring(0, 12)}...</span>
        <Button variant="ghost" size="icon" className="ml-1 h-6 w-6" onClick={handleCopyUid}>
          <Copy size={12} />
        </Button>
      </div>
    </div>
  );
}
