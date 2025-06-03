
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
// Placeholder for crypto functions
import { encryptMessage, decryptMessage, generateAESKeyString, importAESKeyFromString } from '@/lib/crypto';

export default function ChatConversationPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { wickerUser } = useAuth();
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [sharedSecret, setSharedSecret] = useState<CryptoKey | null>(null); // For E2EE
  const { toast } = useToast();

  // Simplified key management: derive a key from chatId for PoC.
  // In a real app, this would use Diffie-Hellman or similar key exchange.
  useEffect(() => {
    const setupEncryptionKey = async () => {
      if (chatId) {
        try {
          // This is NOT secure for production. For demo purposes only.
          // A real app would use a proper key exchange mechanism.
          const pseudoSecretString = `wicker-chat-key-${chatId}`; 
          const key = await generateAESKeyString(pseudoSecretString); // Re-purpose generate to get a string
          const importedKey = await importAESKeyFromString(key, pseudoSecretString); // Then import it
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
         // Fetch participant details if not already present (simple version)
        if (!chatData.participantDetails && chatData.participants) {
          const participantDetailsPromises = chatData.participants.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'users', uid));
            return userDoc.exists() ? userDoc.data() as WickerUser : null;
          });
          const resolvedDetails = (await Promise.all(participantDetailsPromises)).filter(Boolean) as WickerUser[];
          chatData.participantDetails = resolvedDetails.map(u => ({ uid: u.uid, username: u.username, publicKey: u.publicKey }));
        }
        setChatDetails(chatData);
      } else {
        setChatDetails(null);
        toast({ title: "Chat not found", variant: "destructive" });
      }
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
      
      // Update chat's last message and updatedAt timestamp
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: {
          text: content.substring(0, 50), // Snippet of the message
          senderId: wickerUser.uid,
          timestamp: serverTimestamp(),
          contentType: 'text',
        },
        updatedAt: serverTimestamp(),
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: "Message Error", description: "Could not send message.", variant: "destructive"});
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
  
  if (loadingChat) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!chatDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-2xl font-semibold text-destructive">Chat Not Found</h2>
        <p className="text-muted-foreground">This chat may have been deleted or you don't have access.</p>
      </div>
    );
  }
  
  const chatName = chatDetails.isGroupChat ? chatDetails.groupName : chatDetails.participantDetails?.find(p => p.uid !== wickerUser?.uid)?.username || 'Chat';

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="p-4 border-b border-border bg-card flex items-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">{chatName}</h2>
        {/* Placeholder for online status, typing indicator, etc. */}
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
