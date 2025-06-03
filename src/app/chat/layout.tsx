
"use client";
import AuthGuard from '@/components/auth/AuthGuard';
import ChatList from '@/components/chat/ChatList';
import AppShell from '@/components/layout/AppShell';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CreateChatModal from '@/components/chat/CreateChatModal';
import { useState } from 'react';
import type { WickerUser } from '@/lib/types';
import { addDoc, arrayUnion, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreateChatModalOpen, setCreateChatModalOpen] = useState(false);
  const { wickerUser } = useAuth();
  const { toast } = useToast();

  const handleCreateChat = async (selectedUsers: WickerUser[], groupName?: string) => {
    if (!wickerUser) {
      toast({ title: "Error", description: "You must be logged in to create a chat.", variant: "destructive" });
      return Promise.reject(new Error("User not logged in"));
    }
    if (selectedUsers.length === 0) {
      toast({ title: "Error", description: "Please select at least one user.", variant: "destructive" });
      return Promise.reject(new Error("No user selected"));
    }

    const participantUids = [wickerUser.uid, ...selectedUsers.map(u => u.uid)];
    const isGroup = selectedUsers.length > 1 || !!groupName;

    if (isGroup && (!groupName || groupName.trim() === "")) {
        toast({ title: "Error", description: "Group name is required for group chats.", variant: "destructive" });
        return Promise.reject(new Error("Group name required"));
    }
    
    try {
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants: participantUids,
        isGroupChat: isGroup,
        groupName: isGroup ? groupName : null,
        groupAdmins: isGroup ? [wickerUser.uid] : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null,
        // Storing participant details directly in the chat document for easier access in ChatList/ChatWindow
        participantDetails: [
          { uid: wickerUser.uid, username: wickerUser.username, publicKey: wickerUser.publicKey || null },
          ...selectedUsers.map(u => ({ uid: u.uid, username: u.username, publicKey: u.publicKey || null }))
        ]
      });

      toast({ title: "Chat Created", description: isGroup ? `Group "${groupName}" created.` : "Direct chat started." });
      setCreateChatModalOpen(false);
      
      // Introduce a small delay to allow modal to close before navigation
      setTimeout(() => {
        router.push(`/chat/${chatRef.id}`);
      }, 50); // 50ms delay

    } catch (error) {
      console.error("Error creating chat:", error);
      toast({ title: "Error", description: "Could not create chat.", variant: "destructive" });
      return Promise.reject(error); // Propagate error so modal can handle its state
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
