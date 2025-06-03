
"use client";
import ChatWindow from '@/components/chat/ChatWindow';
import MessageInput from '@/components/chat/MessageInput';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import type { Chat, ChatMessage, WickerUser } from '@/lib/types';
import { EphemeralSettingsSuggestion } from '@/lib/types';
import { suggestEphemeralSettings } from '@/ai/flows/suggest-ephemeral-settings'; // AI Flow
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { encryptMessage, decryptMessage, generateAESKeyString, importAESKeyFromString } from '@/lib/crypto';
import { isValid } from 'date-fns'; // For checking timestamp validity

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
    processedMessageIds.current.clear();

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
            
            if (resolvedDetails.length > 0) {
                chatData.participantDetails = resolvedDetails.map(u => ({ uid: u.uid, username: u.username, publicKey: u.publicKey || null }));
            } else { 
                console.warn("Could not resolve any participant details for chat (though participant UIDs exist):", chatId);
            }
            setChatDetails(chatData); 
          } catch (error: any) {
            console.error("Error fetching full participant details:", error);
            toast({ title: "Chat Load Error", description: `Could not load full participant details: ${error.message}. Chat may be incomplete.`, variant: "destructive"});
            setChatDetails(chatData); // Fallback to basic chat data
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
      let newMessages: ChatMessage[] = [];
      const batch = writeBatch(db);
      let shouldCommitBatch = false;
      const idsToDeleteThisCycle = new Set<string>();

      if (sharedSecret && wickerUser && chatDetails) {
        for (const docSnap of snapshot.docs) {
          const msgData = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
          const messageRef = doc(db, `chats/${chatId}/messages`, msgData.id);

          // 1. Handle Expired Messages - Attempt to delete from DB
          if (msgData.expirationTimestamp && msgData.expirationTimestamp.toDate) {
            try {
              const expiryDate = msgData.expirationTimestamp.toDate();
              if (isValid(expiryDate) && expiryDate < new Date()) {
                if (!idsToDeleteThisCycle.has(msgData.id)) {
                  batch.delete(messageRef);
                  shouldCommitBatch = true;
                  idsToDeleteThisCycle.add(msgData.id);
                }
                continue; // Skip further processing for this message
              }
            } catch (e) {
              console.error("Error processing expiration for DB deletion:", e, msgData.expirationTimestamp);
            }
          }
          
          if (idsToDeleteThisCycle.has(msgData.id)) continue;

          // 2. Decrypt content
          if (msgData.encryptedContent) {
            try {
              msgData.decryptedContent = await decryptMessage(msgData.encryptedContent, sharedSecret);
            } catch (e) {
              console.error("Failed to decrypt message:", msgData.id, e);
              msgData.decryptedContent = "[Failed to decrypt message]";
            }
          }
          
          // 3. Handle Read Status and Burn-on-Read Deletion (for 1-on-1)
          if (msgData.senderId !== wickerUser.uid && (!msgData.readBy || !msgData.readBy[wickerUser.uid])) {
            if (!processedMessageIds.current.has(msgData.id)) { 
              batch.update(messageRef, {
                [`readBy.${wickerUser.uid}`]: serverTimestamp(),
                status: 'read' 
              });
              shouldCommitBatch = true;
              processedMessageIds.current.add(msgData.id); 
              msgData.readBy = { ...msgData.readBy, [wickerUser.uid]: serverTimestamp() as any }; 
              msgData.status = 'read'; 

              if (msgData.isBurnOnRead && !chatDetails.isGroupChat) {
                 if (!idsToDeleteThisCycle.has(msgData.id)) {
                    batch.delete(messageRef);
                    idsToDeleteThisCycle.add(msgData.id);
                    // shouldCommitBatch is already true
                 }
                 // If deleted, it will be filtered out from newMessages before setting state
                 continue; // Skip adding to newMessages if burned and deleted
              }
            }
          }
          newMessages.push(msgData);
        }
      } else {
         snapshot.docs.forEach(docSnap => {
            const msgData = { id: docSnap.id, ...docSnap.data() } as ChatMessage;
            // Basic handling if decryption/user context isn't ready
            if (msgData.expirationTimestamp && msgData.expirationTimestamp.toDate) {
                try {
                    const expiryDate = msgData.expirationTimestamp.toDate();
                    if (isValid(expiryDate) && expiryDate < new Date()) return; // Don't add if expired
                } catch (e) { /* ignore */ }
            }
            msgData.decryptedContent = "[Encryption key not ready or user not loaded]";
            newMessages.push(msgData);
         });
      }

      // Filter out messages that were marked for deletion in this processing cycle
      setMessages(newMessages.filter(msg => !idsToDeleteThisCycle.has(msg.id)));
      
      if (shouldCommitBatch) {
        try {
            await batch.commit();
        } catch (error) {
            console.error("Error committing batch updates/deletions:", error);
            toast({ title: "Sync Error", description: "Could not update/delete messages.", variant: "destructive" });
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
  }, [chatId, wickerUser, sharedSecret, toast, chatDetails]); // Added chatDetails to dependencies

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
        readBy: {}, 
      };
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
      
      let lastMessageText = content.substring(0, 50);
      if (messageData.isBurnOnRead || (messageData.expirationTimestamp && messageData.expirationTimestamp.toDate && messageData.expirationTimestamp.toDate() <= new Date(Date.now() + 60000))) { 
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
  
  if (loadingChat && !chatDetails) { 
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
          Could not load chat details. The chat may not exist, or you might be offline.
        </p>
      </div>
    );
  }

  const chatName = chatDetails.isGroupChat
    ? chatDetails.groupName
    : chatDetails.participantDetails?.find(p => p.uid !== wickerUser.uid)?.username || 'Chat';

  return (
    <div className="flex-1 flex flex-col"> {/* Removed h-full */}
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

    