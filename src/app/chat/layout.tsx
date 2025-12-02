"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import ChatList from '@/components/chat/ChatList';
import AppShell from '@/components/layout/AppShell';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CreateChatModal from '@/components/chat/CreateChatModal';
import { useState } from 'react';
import type { UserProfile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreateChatModalOpen, setCreateChatModalOpen] = useState(false);
  const { wickerUser } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();

  const handleCreateChat = async (selectedUsers: UserProfile[], groupName?: string) => {
    if (!wickerUser) {
      toast({ title: "Error", description: "You must be logged in to create a chat.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }
    if (selectedUsers.length === 0) {
      toast({ title: "Error", description: "Please select at least one user.", variant: "destructive" });
      return Promise.reject(new Error("No user selected"));
    }

    const participantUids = [wickerUser.id, ...selectedUsers.map(u => u.id)];
    const isGroup = selectedUsers.length > 1 || !!groupName;

    if (isGroup && (!groupName || groupName.trim() === "")) {
        toast({ title: "Error", description: "Group name is required for group chats.", variant: "destructive" });
        return Promise.reject(new Error("Group name required"));
    }
    
    try {
      const { data, error } = await supabase.rpc('create_conversation_and_add_participants', {
        p_is_group_chat: isGroup,
        p_group_name: isGroup ? groupName : null,
        p_participants: participantUids,
        p_group_admins: isGroup ? [wickerUser.id] : null,
      });

      if (error) throw error;
      if (!data) throw new Error("Failed to create chat, no ID returned.");
      
      const newChatId = data;

      toast({ title: "Chat Created", description: isGroup ? `Group "${groupName}" created.` : "Direct chat started." });
      setCreateChatModalOpen(false);
      
      setTimeout(() => {
        router.push(`/chat/${newChatId}`);
      }, 50);

    } catch (error: any) {
      console.error("Error creating chat:", error);
      toast({ title: "Error", description: `Could not create chat: ${error.message}`, variant: "destructive" });
      return Promise.reject(error);
    }
  };
  
  return (
    <AuthGuard>
      <AppShell
        sidebarContent={<ChatList activeChatId={pathname.split('/').pop() || ''} />}
        mainContent={children}
        onNewChat={() => setCreateChatModalOpen(true)}
      />
      <CreateChatModal
        isOpen={isCreateChatModalOpen}
        onClose={() => setCreateChatModalOpen(false)}
        onCreateChat={handleCreateChat}
      />
    </AuthGuard>
  );
}
