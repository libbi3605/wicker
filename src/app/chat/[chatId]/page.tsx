
"use client";
import ChatWindow from '@/components/chat/ChatWindow';
import MessageInput from '@/components/chat/MessageInput';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import type { Chat, ChatMessage, WickerUser } from '@/lib/types';
import { EphemeralSettingsSuggestion } from '@/lib/types';
import { suggestEphemeralSettings } from '@/ai/flows/suggest-ephemeral-settings'; // AI Flow
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { encryptMessage, decryptMessage, generateAESKeyString, importAESKeyFromString } from '@/lib/crypto';

export default function ChatConversationPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { wickerUser, loading: authLoading } = useAuth();
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [sharedSecret, setSharedSecret] = useState<CryptoKey | null>(null);
  const { toast } = useToast();

  // Early exit if auth is still loading
  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading user profile...</p>
      </div>
    );
  }

  // Early exit if wickerUser (user profile from Firestore) is not available after auth loading
  if (!wickerUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-semibold text-destructive">User Profile Error</h2>
        <p className="text-muted-foreground max-w-md">
          Could not load your user profile. You might be offline or an authentication issue occurred.
        </p>
        <p className="text-sm mt-4 text-muted-foreground">Please try refreshing or check your internet connection.</p>
      </div>
    );
  }

  useEffect(() => {
    const setupEncryptionKey = async () => {
      if (chatId) {
        try {
          const pseudoSecretString = `wicker-chat-key-${chatId}`;
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
  }, [chatId, toast]);


  useEffect(() => {
    if (!chatId || !wickerUser.uid) return;
    setLoadingChat(true);

    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribeChatDetails = onSnapshot(chatDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
        // Attempt to fetch participant details if not already present or if participants array exists
        if ((!chatData.participantDetails || chatData.participantDetails.length === 0) && chatData.participants && chatData.participants.length > 0) {
          try {
            const participantDetailsPromises = chatData.participants.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? userDoc.data() as WickerUser : null;
            });
            const resolvedDetails = (await Promise.all(participantDetailsPromises)).filter(Boolean) as WickerUser[];
            if (resolvedDetails.length !== chatData.participants.length && chatData.participants.length > 0) {
                 // This implies some user docs might not have been found or fetched, which could be an issue
                 console.warn("Not all participant details could be resolved for chat:", chatId);
            }
            chatData.participantDetails = resolvedDetails.map(u => ({ uid: u.uid, username: u.username, publicKey: u.publicKey }));
            setChatDetails(chatData);
          } catch (error) {
            console.error("Error fetching full participant details:", error);
            toast({ title: "Chat Load Error", description: "Could not load full participant details. Chat may be incomplete.", variant: "destructive"});
            // Set chatDetails to null if fetching participant details fails critically
            setChatDetails(null); 
            setLoadingChat(false);
            return; // Exit if participant details fetch fails
          }
        } else {
            setChatDetails(chatData); // Set if details already exist or no participants to fetch
        }
      } else {
        setChatDetails(null);
        toast({ title: "Chat not found", description: "This chat may no longer exist.", variant: "destructive" });
      }
      // setLoadingChat(false); // Moved setting loading false to after message logic or error cases
    }, (error) => {
      console.error("Error fetching chat details snapshot:", error);
      toast({ title: "Chat Load Error", description: "Could not load chat details. You might be offline.", variant: "destructive"});
      setChatDetails(null);
      setLoadingChat(false);
    });

    const messagesQuery = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, async (snapshot) => {
      const newMessages: ChatMessage[] = [];
      if (sharedSecret) {
        for (const docSnap of snapshot.docs) {
          const msgData = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
          if (msgData.encryptedContent) {
            try {
              msgData.decryptedContent = await decryptMessage(msgData.encryptedContent, sharedSecret);
            } catch (e) {
              console.error("Failed to decrypt message:", msgData.id, e);
              msgData.decryptedContent = "[Failed to decrypt message]";
            }
          }
          newMessages.push(msgData);
        }
      } else {
         snapshot.docs.forEach(docSnap => {
            const msgData = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
            msgData.decryptedContent = "[Encryption key not ready]";
            newMessages.push(msgData);
         });
      }
      setMessages(newMessages);
      setLoadingChat(false); // Set loading to false after messages are processed
    }, (error) => {
      console.error("Error fetching messages snapshot:", error);
      toast({ title: "Message Load Error", description: "Could not load messages. You might be offline.", variant: "destructive"});
      setMessages([]);
      setLoadingChat(false);
    });

    return () => {
      unsubscribeChatDetails();
      unsubscribeMessages();
    };
  }, [chatId, wickerUser.uid, sharedSecret, toast]);

  const handleSendMessage = useCallback(async (content: string, ephemeralSettings?: Partial<ChatMessage>) => {
    if (!wickerUser || !wickerUser.uid) {
        toast({ title: "User Error", description: "User profile not available. Cannot send message.", variant: "destructive"});
        return;
    }
    if (!chatId || !content.trim() || !sharedSecret) {
        if (!sharedSecret) {
            toast({ title: "Encryption Error", description: "Secure channel not ready. Cannot send message.", variant: "destructive"});
        }
        return;
    }

    try {
      const encryptedContent = await encryptMessage(content, sharedSecret);
      const messageData: Omit<ChatMessage, 'id' | 'decryptedContent'> = {
        chatId,
        senderId: wickerUser.uid,
        senderUsername: wickerUser.username,
        encryptedContent,
        contentType: 'text',
        timestamp: serverTimestamp() as any,
        isBurnOnRead: ephemeralSettings?.isBurnOnRead || false,
        expirationTimestamp: ephemeralSettings?.expirationTimestamp || null,
        status: 'sent',
      };
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: {
          text: content.substring(0, 50),
          senderId: wickerUser.uid,
          timestamp: serverTimestamp(),
          contentType: 'text',
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: "Message Error", description: "Could not send message. You might be offline.", variant: "destructive"});
    }
  }, [chatId, wickerUser, sharedSecret, toast]);

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

  // Loading state for chat data (after user profile is confirmed loaded)
  if (loadingChat) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading chat data...</p>
      </div>
    );
  }

  // If loading chat data is complete, but chatDetails is still null
  if (!chatDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-semibold text-destructive">Chat Error</h2>
        <p className="text-muted-foreground max-w-md">
          Could not load chat details. The chat may not exist, participant data could not be fully loaded, or you might be offline.
        </p>
      </div>
    );
  }

  // wickerUser is guaranteed non-null by early return. chatDetails is guaranteed non-null here.
  const chatName = chatDetails.isGroupChat
    ? chatDetails.groupName
    : chatDetails.participantDetails?.find(p => p.uid !== wickerUser.uid)?.username || 'Chat';

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="p-4 border-b border-border bg-card flex items-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">{chatName || "Chat"}</h2>
      </header>
      <ChatWindow messages={messages} currentUserId={wickerUser.uid} />
      <MessageInput
        onSendMessage={handleSendMessage}
        onSuggestSettings={handleAiSuggestSettings}
        chatId={chatId}
      />
    </div>
  );
}
