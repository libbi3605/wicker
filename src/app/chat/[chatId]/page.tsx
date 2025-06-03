
"use client";
import ChatWindow from '@/components/chat/ChatWindow';
import MessageInput from '@/components/chat/MessageInput';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import type { Chat, ChatMessage, WickerUser } from '@/lib/types';
import { EphemeralSettingsSuggestion } from '@/lib/types';
import { suggestEphemeralSettings } from '@/ai/flows/suggest-ephemeral-settings'; // AI Flow
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { encryptMessage, decryptMessage, generateAESKeyString, importAESKeyFromString } from '@/lib/crypto';

export default function ChatConversationPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { wickerUser } = useAuth();
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [sharedSecret, setSharedSecret] = useState<CryptoKey | null>(null); 
  const { toast } = useToast();

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
    if (!chatId || !wickerUser?.uid) return;
    setLoadingChat(true);

    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribeChatDetails = onSnapshot(chatDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
        if (!chatData.participantDetails && chatData.participants) {
          try {
            const participantDetailsPromises = chatData.participants.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? userDoc.data() as WickerUser : null;
            });
            const resolvedDetails = (await Promise.all(participantDetailsPromises)).filter(Boolean) as WickerUser[];
            chatData.participantDetails = resolvedDetails.map(u => ({ uid: u.uid, username: u.username, publicKey: u.publicKey }));
          } catch (error) {
            console.error("Error fetching participant details:", error);
            // Continue with chat data even if participant details fail
          }
        }
        setChatDetails(chatData);
      } else {
        setChatDetails(null);
        toast({ title: "Chat not found", description: "This chat may no longer exist.", variant: "destructive" });
      }
      // setLoadingChat(false); // Moved to messages listener or a combined logic
    }, (error) => {
      console.error("Error fetching chat details snapshot:", error);
      toast({ title: "Chat Load Error", description: "Could not load chat details. You might be offline.", variant: "destructive"});
      setChatDetails(null); // Ensure chat details are cleared on error
      setLoadingChat(false);
    });

    const messagesQuery = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribeMessages = onSnapshot(messagesQuery, async (snapshot) => {
      const newMessages: ChatMessage[] = [];
      for (const docSnap of snapshot.docs) {
        const msgData = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
        if (sharedSecret && msgData.encryptedContent) {
          try {
            msgData.decryptedContent = await decryptMessage(msgData.encryptedContent, sharedSecret);
          } catch (e) {
            console.error("Failed to decrypt message:", msgData.id, e);
            msgData.decryptedContent = "[Failed to decrypt message]";
          }
        }
        newMessages.push(msgData);
      }
      setMessages(newMessages);
      setLoadingChat(false); // Set loading to false after messages (or chat details) are processed
    }, (error) => {
      console.error("Error fetching messages snapshot:", error);
      toast({ title: "Message Load Error", description: "Could not load messages. You might be offline.", variant: "destructive"});
      setMessages([]); // Clear messages on error
      setLoadingChat(false);
    });

    return () => {
      unsubscribeChatDetails();
      unsubscribeMessages();
    };
  }, [chatId, wickerUser?.uid, sharedSecret, toast]);

  const handleSendMessage = useCallback(async (content: string, ephemeralSettings?: Partial<ChatMessage>) => {
    if (!chatId || !wickerUser?.uid || !content.trim() || !sharedSecret) return;

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
  
  if (loadingChat && !chatDetails && messages.length === 0) { // More robust loading check
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!chatDetails && !loadingChat) { // If loading is done and still no chat details
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-2xl font-semibold text-destructive">Chat Not Found or Error</h2>
        <p className="text-muted-foreground">This chat may have been deleted, you might be offline, or an error occurred.</p>
      </div>
    );
  }
  
  // Fallback chatName if participantDetails are somehow missing after load
  const chatName = chatDetails?.isGroupChat 
    ? chatDetails.groupName 
    : chatDetails?.participantDetails?.find(p => p.uid !== wickerUser?.uid)?.username || 'Chat';

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="p-4 border-b border-border bg-card flex items-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">{chatName || (loadingChat ? "Loading..." : "Chat")}</h2>
      </header>
      <ChatWindow messages={messages} currentUserId={wickerUser?.uid || ''} />
      <MessageInput 
        onSendMessage={handleSendMessage}
        onSuggestSettings={handleAiSuggestSettings}
        chatId={chatId}
      />
    </div>
  );
}
