
"use client";
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import type { Chat } from '@/lib/types';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { MessageSquareText, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';

interface ChatListProps {
  activeChatId: string;
}

export default function ChatList({ activeChatId }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { wickerUser } = useAuth();

  useEffect(() => {
    if (!wickerUser?.uid) return;

    setLoading(true);
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', wickerUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching chats:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [wickerUser?.uid]);

  const getChatNameAndAvatar = (chat: Chat) => {
    if (chat.isGroupChat) {
      return {
        name: chat.groupName || 'Group Chat',
        avatarInitial: chat.groupName?.substring(0, 1).toUpperCase() || 'G',
        isGroup: true,
      };
    }
    // For 1-on-1 chat, find the other participant
    // This part requires fetching other user's details or having them denormalized in chat doc.
    // For simplicity, we'll use a placeholder. A full implementation would fetch user profiles.
    const otherParticipantId = chat.participants.find(p => p !== wickerUser?.uid);
    const otherUserName = chat.participantDetails?.find(p => p.uid === otherParticipantId)?.username || 'User';

    return {
      name: otherUserName,
      avatarInitial: otherUserName.substring(0,1).toUpperCase() || 'U',
      isGroup: false,
    };
  };


  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (chats.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No active chats. Start a new one!</div>;
  }

  return (
    <nav className="flex flex-col space-y-1">
      {chats.map((chat) => {
        const { name, avatarInitial, isGroup } = getChatNameAndAvatar(chat);
        const isActive = chat.id === activeChatId;
        return (
          <Link
            href={`/chat/${chat.id}`}
            key={chat.id}
            className={`flex items-center space-x-3 p-3 rounded-md hover:bg-accent/50 transition-colors
                        ${isActive ? 'bg-accent text-accent-foreground shadow-sm' : 'text-foreground'}`}
          >
            <Avatar className="h-10 w-10">
               <AvatarImage src={`https://placehold.co/100x100.png?text=${avatarInitial}`} alt={name} data-ai-hint={isGroup ? "group collaboration" : "person avatar"}/>
              <AvatarFallback>{avatarInitial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium truncate">{name}</p>
                {chat.lastMessage?.timestamp && (
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNowStrict(chat.lastMessage.timestamp.toDate(), { addSuffix: true })}
                  </p>
                )}
              </div>
              <p className={`text-xs truncate ${isActive ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                {chat.lastMessage?.text || (chat.lastMessage?.contentType === 'image' ? 'Image' : chat.lastMessage?.contentType === 'file' ? 'File' : 'No messages yet')}
              </p>
            </div>
             {isGroup ? <Users size={16} className="text-muted-foreground" /> : <MessageSquareText size={16} className="text-muted-foreground" />}
          </Link>
        );
      })}
    </nav>
  );
}
