
"use client";
import ChatWindow from '@/components/chat/ChatWindow';
import MessageInput from '@/components/chat/MessageInput';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import type { Chat, ChatMessage, WickerUser } from '@/lib/types';
import { EphemeralSettingsSuggestion } from '@/lib/types';
import { suggestEphemeralSettings } from '@/ai/flows/suggest-ephemeral-settings'; // AI Flow
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
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
  const processedMessageIds = useRef(new Set<string>());


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
    if (!chatId || !wickerUser) {
        setLoadingChat(false);
        return;
    }
    setLoadingChat(true);
    processedMessageIds.current.clear(); // Reset processed messages when chat ID changes

    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribeChatDetails = onSnapshot(chatDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
        
        if ((!chatData.participantDetails || chatData.participantDetails.length === 0) && chatData.participants && chatData.participants.length > 0) {
          try {
            const participantDetailsPromises = chatData.participants.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? userDoc.data() as WickerUser : null;
            });
            const resolvedDetails = (await Promise.all(participantDetailsPromises)).filter(Boolean) as WickerUser[];
            
            if (resolvedDetails.length > 0) { // Ensure some details were resolved
                chatData.participantDetails = resolvedDetails.map(u => ({ uid: u.uid, username: u.username, publicKey: u.publicKey }));
                setChatDetails(chatData);
            } else if (chatData.participants.length > 0) { // If participants exist but no details resolved
                console.warn("Could not resolve any participant details for chat:", chatId);
                toast({ title: "Chat Load Warning", description: "Could not load full participant details. Some information may be missing.", variant: "default"});
                setChatDetails(chatData); // Set with what we have, UI might show UIDs
            } else { // No participants to begin with
                setChatDetails(chatData);
            }

          } catch (error: any) {
            console.error("Error fetching full participant details:", error);
            toast({ title: "Chat Load Error", description: `Could not load full participant details: ${error.message}. Chat may be incomplete.`, variant: "destructive"});
            setChatDetails(null); 
            setLoadingChat(false);
            return; 
          }
        } else {
            setChatDetails(chatData); 
        }
      } else {
        setChatDetails(null);
        toast({ title: "Chat not found", description: "This chat may no longer exist.", variant: "destructive" });
      }
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
      const batch = writeBatch(db);
      let shouldCommitBatch = false;

      if (sharedSecret && wickerUser) {
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
          
          // Mark as read logic
          if (msgData.senderId !== wickerUser.uid && (!msgData.readBy || !msgData.readBy[wickerUser.uid])) {
            if (!processedMessageIds.current.has(msgData.id)) { // Check if already processed
              const messageRef = doc(db, `chats/${chatId}/messages`, msgData.id);
              batch.update(messageRef, {
                [`readBy.${wickerUser.uid}`]: serverTimestamp(),
                status: 'read' // Simplified status, might need more complex logic for groups
              });
              shouldCommitBatch = true;
              processedMessageIds.current.add(msgData.id); // Mark as processed
              // Update local copy immediately for UI responsiveness
              msgData.readBy = { ...msgData.readBy, [wickerUser.uid]: serverTimestamp() as any };
              msgData.status = 'read';
            }
          }
          newMessages.push(msgData);
        }
      } else {
         snapshot.docs.forEach(docSnap => {
            const msgData = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
            msgData.decryptedContent = "[Encryption key not ready or user not loaded]";
            newMessages.push(msgData);
         });
      }
      setMessages(newMessages);
      if (shouldCommitBatch) {
        try {
            await batch.commit();
        } catch (error) {
            console.error("Error committing read status updates:", error);
            toast({ title: "Read Status Error", description: "Could not update read statuses.", variant: "destructive" });
        }
      }
      setLoadingChat(false); 
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
  }, [chatId, wickerUser, sharedSecret, toast]);

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
        timestamp: serverTimestamp() as any, // Firestore will convert this
        isBurnOnRead: ephemeralSettings?.isBurnOnRead || false,
        expirationTimestamp: ephemeralSettings?.expirationTimestamp || null,
        status: 'sent',
        readBy: {}, // Initialize readBy
      };
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
      
      // Determine last message text, prioritizing decrypted content if available
      // For ephemeral messages, consider if the snippet should be generic
      let lastMessageText = content.substring(0, 50);
      if (messageData.isBurnOnRead || (messageData.expirationTimestamp && messageData.expirationTimestamp.toDate() <= new Date(Date.now() + 60000))) { // soon to expire
         lastMessageText = "Ephemeral message";
      }


      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: {
          text: lastMessageText,
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
        <p className="text-muted-foreground max-w-md">
          Could not load your user profile. You might be offline or an authentication issue occurred.
        </p>
        <p className="text-sm mt-4 text-muted-foreground">Please try refreshing or check your internet connection.</p>
      </div>
    );
  }
  
  if (loadingChat && !chatDetails) { // Adjusted loading condition
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading chat data...</p>
      </div>
    );
  }

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
