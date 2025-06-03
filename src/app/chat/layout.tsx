
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
      return;
    }
    if (selectedUsers.length === 0) {
      toast({ title: "Error", description: "Please select at least one user.", variant: "destructive" });
      return;
    }

    const participantUids = [wickerUser.uid, ...selectedUsers.map(u => u.uid)];
    const isGroup = selectedUsers.length > 1 || !!groupName;

    if (isGroup && (!groupName || groupName.trim() === "")) {
        toast({ title: "Error", description: "Group name is required for group chats.", variant: "destructive" });
        return;
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
      });

      // Add chat reference to each user's profile (optional, for quick access)
      // This part can be complex and might be better handled by queries.
      // For now, let's skip updating user docs to keep it simpler.
      // const batch = writeBatch(db);
      // participantUids.forEach(uid => {
      //   const userChatRef = doc(db, `users/${uid}/chats`, chatRef.id);
      //   batch.set(userChatRef, { joinedAt: serverTimestamp() });
      // });
      // await batch.commit();

      toast({ title: "Chat Created", description: isGroup ? `Group "${groupName}" created.` : "Direct chat started." });
      setCreateChatModalOpen(false);
      router.push(`/chat/${chatRef.id}`);
    } catch (error) {
      console.error("Error creating chat:", error);
      toast({ title: "Error", description: "Could not create chat.", variant: "destructive" });
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
