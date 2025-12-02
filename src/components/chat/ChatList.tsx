"use client";
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Conversation, ConversationParticipant } from '@/lib/types';
import { MessageSquareText, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast'; 

interface ChatListProps {
  activeChatId: string;
}

export default function ChatList({ activeChatId }: ChatListProps) {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { wickerUser } = useAuth();
  const { toast } = useToast(); 
  const supabase = createClient();

  useEffect(() => {
    if (!wickerUser) {
      setLoading(false);
      setChats([]);
      return;
    }

    setLoading(true);
    
    const fetchConversations = async () => {
      const { data, error } = await supabase
        .rpc('get_user_conversations_with_details');

      if (error) {
        console.error("Error fetching conversations:", error);
        toast({ 
          title: "Chat List Error",
          description: "Could not load your chats. You might be offline or an error occurred.",
          variant: "destructive",
        });
        setChats([]);
      } else {
        setChats(data || []);
      }
      setLoading(false);
    };

    fetchConversations();

    const channel = supabase
      .channel('conversations_and_messages_for_user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, fetchConversations)
      .subscribe((status, err) => {
        if (err) {
          console.error('Subscription error:', err);
          toast({ title: 'Real-time Error', description: 'Could not connect to real-time updates.', variant: 'destructive'});
        }
      });
      
    return () => {
      supabase.removeChannel(channel);
    };

  }, [wickerUser, toast, supabase]);

  const getChatNameAndAvatar = (chat: Conversation) => {
    if (chat.is_group_chat) {
      return {
        name: chat.group_name || 'Group Chat',
        avatarInitial: chat.group_name?.substring(0, 1).toUpperCase() || 'G',
        isGroup: true,
      };
    }

    const currentUserId = wickerUser?.id;
    const otherParticipant = chat.participants?.find(p => p.user_id !== currentUserId);
    const otherUserName = otherParticipant?.username || 'User';

    return {
      name: otherUserName,
      avatarInitial: otherUserName.substring(0,1).toUpperCase() || 'U',
      isGroup: false,
    };
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (chats.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No active chats. Start a new one!</div>;
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
                {chat.last_message_timestamp && (
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNowStrict(parseISO(chat.last_message_timestamp), { addSuffix: true })}
                  </p>
                )}
              </div>
              <p className={`text-xs truncate ${isActive ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                {chat.last_message_text || (chat.last_message_content_type === 'image' ? 'Image' : chat.last_message_content_type === 'file' ? 'File' : 'No messages yet')}
              </p>
            </div>
             {isGroup ? <Users size={16} className="text-muted-foreground" /> : <MessageSquareText size={16} className="text-muted-foreground" />}
          </Link>
        );
      })}
    </nav>
  );
}
