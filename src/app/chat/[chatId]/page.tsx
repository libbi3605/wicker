"use client";
import ChatWindow from '@/components/chat/ChatWindow';
import MessageInput from '@/components/chat/MessageInput';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Conversation, Message, UserProfile } from '@/lib/types';
import { EphemeralSettingsSuggestion } from '@/lib/types';
import { suggestEphemeralSettings } from '@/ai/flows/suggest-ephemeral-settings';
import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { encryptMessage, decryptMessage, generateAESKeyString, importAESKeyFromString } from '@/lib/crypto';
import { isValid, parseISO } from 'date-fns';

export default function ChatConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.chatId as string;
  const { wickerUser, loading: authLoading } = useAuth();
  const [conversationDetails, setConversationDetails] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [sharedSecret, setSharedSecret] = useState<CryptoKey | null>(null);
  const { toast } = useToast();
  const processedMessageIds = useRef(new Set<string>());
  const supabase = createClient();


  // Set up end-to-end encryption key
  useEffect(() => {
    const setupEncryptionKey = async () => {
      if (conversationId) {
        try {
          const pseudoSecretString = `wicker-chat-key-${conversationId}`;
          const key = await generateAESKeyString(pseudoSecretString);
          const importedKey = await importAESKeyFromString(key, pseudoSecretString);
          setSharedSecret(importedKey);
        } catch (error) {
          console.error("Error setting up encryption key:", error);
          toast({ title: "Encryption Error", description: "Could not set up secure channel.", variant: "destructive"});
        }
      }
    };
    setupEncryptionKey();
  }, [conversationId, toast]);


  // Main effect for fetching data and subscribing to real-time updates
  useEffect(() => {
    if (!conversationId || !wickerUser || !sharedSecret) {
      setLoadingChat(false);
      return;
    }

    setLoadingChat(true);
    processedMessageIds.current.clear();

    const handleNewMessages = async (newMessages: Message[]) => {
      if (!sharedSecret || !wickerUser) return;

      const decryptedMessages = await Promise.all(
        newMessages.map(async (msg) => {
          if (msg.encrypted_content && !msg.decryptedContent) {
            try {
              msg.decryptedContent = await decryptMessage(msg.encrypted_content, sharedSecret);
            } catch (e) {
              console.error("Failed to decrypt message:", msg.id, e);
              msg.decryptedContent = "[Failed to decrypt message]";
            }
          }
          return msg;
        })
      );
      
      const uniqueMessages = Array.from(new Map(decryptedMessages.map(m => [m.id, m])).values())
        .sort((a,b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime());

      setMessages(uniqueMessages);

      // Handle read status updates
      const unreadMessages = uniqueMessages.filter(
        msg => msg.sender_id !== wickerUser.id && (!msg.read_by || !msg.read_by[wickerUser.id])
      );
      if (unreadMessages.length > 0) {
        const updates = unreadMessages.map(msg => ({
          id: msg.id,
          read_by: {
            ...msg.read_by,
            [wickerUser.id]: new Date().toISOString(),
          },
          status: 'read'
        }));
        await supabase.from('messages').upsert(updates);

        // Handle burn-on-read (non-group chats)
        if (!conversationDetails?.is_group_chat) {
          const burnableMessageIds = unreadMessages
            .filter(msg => msg.is_burn_on_read)
            .map(msg => msg.id);

          if (burnableMessageIds.length > 0) {
            await supabase.from('messages').delete().in('id', burnableMessageIds);
          }
        }
      }
    };

    const fetchInitialData = async () => {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`*, participants:conversation_participants(user_id, profiles:users(username))`)
        .eq('id', conversationId)
        .single();
      
      if (convError) {
        console.error("Error fetching conversation details:", convError);
        toast({ title: "Chat Load Error", description: convError.message, variant: "destructive" });
        setLoadingChat(false);
        router.push('/chat');
        return;
      }
      
      const participants = convData.participants.map((p: any) => ({ user_id: p.user_id, username: p.profiles.username }));
      setConversationDetails({ ...convData, participants });

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        toast({ title: "Message Load Error", description: messagesError.message, variant: "destructive" });
      } else {
        await handleNewMessages(messagesData || []);
      }
      setLoadingChat(false);
    };

    fetchInitialData();

    // Subscribe to real-time messages
    const channel = supabase
      .channel(`chat-room-${conversationId}`)
      .on<Message>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
           if (payload.eventType === 'INSERT') {
             const newMessage = payload.new as Message;
             setMessages(currentMessages => {
                const combined = [...currentMessages, newMessage];
                const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
                return unique.sort((a,b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime());
             });
             await handleNewMessages(messages);
           } else if (payload.eventType === 'UPDATE') {
              const updatedMessage = payload.new as Message;
              setMessages(currentMessages => currentMessages.map(m => m.id === updatedMessage.id ? {...m, ...updatedMessage} : m));
           } else if (payload.eventType === 'DELETE') {
              const deletedMessageId = payload.old.id;
              setMessages(currentMessages => currentMessages.filter(m => m.id !== deletedMessageId));
           }
        }
      )
      .subscribe((status, err) => {
        if (err) {
            console.error('Channel subscription error:', err);
            toast({ title: 'Real-time Error', description: 'Connection to chat updates failed.', variant: 'destructive'});
        }
      });
      
    // Cleanup: Delete expired messages client-side. A server-side cron job is better for this.
    const interval = setInterval(async () => {
      const { data: expired, error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .not('expiration_timestamp', 'is', null)
        .lt('expiration_timestamp', new Date().toISOString());

      if (error) {
        console.warn("Could not clean up expired messages:", error.message);
      }
    }, 60000); // Check every minute

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [conversationId, wickerUser, sharedSecret, toast, supabase, router, conversationDetails?.is_group_chat]);

  const handleSendMessage = useCallback(async (content: string, ephemeralSettings?: Partial<Message>) => {
    if (!wickerUser || !wickerUser.user_profile) {
        toast({ title: "User Error", description: "User profile not available.", variant: "destructive"});
        return;
    }
    if (!conversationId || !content.trim() || !sharedSecret) {
        if (!sharedSecret) toast({ title: "Encryption Error", description: "Secure channel not ready.", variant: "destructive"});
        return;
    }

    try {
      const encryptedContent = await encryptMessage(content, sharedSecret);
      const messageData: Omit<Message, 'id' | 'created_at' | 'decryptedContent'> = {
        conversation_id: conversationId,
        sender_id: wickerUser.id,
        sender_username: wickerUser.user_profile.username,
        encrypted_content: encryptedContent,
        content_type: 'text',
        is_burn_on_read: ephemeralSettings?.is_burn_on_read || false,
        expiration_timestamp: ephemeralSettings?.expiration_timestamp || null,
        status: 'sent',
        read_by: {},
      };
      
      const { error } = await supabase.from('messages').insert([messageData]);
      if (error) throw error;
      
      // The conversation `updated_at` is now handled by a database trigger.

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({ title: "Message Error", description: `Could not send message: ${error.message}`, variant: "destructive"});
    }
  }, [conversationId, wickerUser, sharedSecret, toast, supabase]);

  const handleAiSuggestSettings = async (messageContent: string): Promise<EphemeralSettingsSuggestion | null> => {
    if (!messageContent.trim()) return null;
    try {
      const suggestion = await suggestEphemeralSettings({ message: messageContent });
      return suggestion;
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      toast({ title: "AI Suggestion Error", description: "Could not get suggestions from AI.", variant: "destructive"});
      return null;
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading user profile...</p>
      </div>
    );
  }

  if (!wickerUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-semibold text-destructive">User Profile Error</h2>
        <p className="text-muted-foreground max-w-md">Could not load your user profile.</p>
      </div>
    );
  }
  
  if (loadingChat && !conversationDetails) { 
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading chat data...</p>
      </div>
    );
  }

  if (!conversationDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-semibold text-destructive">Chat Error</h2>
        <p className="text-muted-foreground max-w-md">Could not load chat details.</p>
      </div>
    );
  }

  const chatName = conversationDetails.is_group_chat
    ? conversationDetails.group_name
    : conversationDetails.participants?.find(p => p.user_id !== wickerUser.id)?.username || 'Chat';

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-4 border-b border-border bg-card flex items-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">{chatName || "Chat"}</h2>
      </header>
      <ChatWindow messages={messages} currentUserId={wickerUser.id} />
      <MessageInput
        onSendMessage={handleSendMessage}
        onSuggestSettings={handleAiSuggestSettings}
        chatId={conversationId}
      />
    </div>
  );
}
