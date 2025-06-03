
"use client";
import type { ChatMessage } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { Clock, Flame, Eye } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUserId: string;
}

export default function ChatWindow({ messages, currentUserId }: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'auto' });
    }
  }, [messages]);

  const filteredMessages = messages.filter(msg => {
    if (msg.isBurnOnRead && msg.readBy && msg.readBy[currentUserId]) {
      return false; 
    }
    if (msg.expirationTimestamp && msg.expirationTimestamp.toDate) {
      try {
        const expiryDate = msg.expirationTimestamp.toDate();
        if (isValid(expiryDate) && expiryDate < new Date()) {
          return false; 
        }
      } catch (e) {
        console.error("Error converting Firestore Timestamp to Date for expiration check:", e, msg.expirationTimestamp);
      }
    }
    return true;
  });

  return (
    <ScrollArea className="flex-1 p-4 bg-background min-h-0 relative" ref={scrollAreaRef}> {/* Added relative */}
      {/* Background Logo Div */}
      <div
        className="absolute inset-0 z-0 bg-no-repeat bg-center bg-contain opacity-10 pointer-events-none"
        style={{ backgroundImage: `url('https://i.imgur.com/qRm5rG3.png')` }}
      />
      {/* Messages container - needs to be on top */}
      <div className="space-y-1 relative z-10"> {/* Added relative z-10 */}
        {filteredMessages.map((msg, index) => {
          const isCurrentUser = msg.senderId === currentUserId;
          const senderInitial = msg.senderUsername?.substring(0, 1).toUpperCase() || '?';
          
          const prevMessage = filteredMessages[index - 1];
          const isFirstInSenderBlock = index === 0 || prevMessage?.senderId !== msg.senderId;
          const showAvatarAndName = !isCurrentUser && isFirstInSenderBlock;
          
          let ephemeralIndicator = null;
          if (msg.isBurnOnRead) {
            ephemeralIndicator = <Flame size={12} className="text-orange-500" title="Burn on read" />;
          } else if (msg.expirationTimestamp && msg.expirationTimestamp.toDate) {
            try {
                const expiryDate = msg.expirationTimestamp.toDate();
                if (isValid(expiryDate) && expiryDate >= new Date()) { 
                    ephemeralIndicator = <Clock size={12} className="text-blue-500" title={`Expires ${format(expiryDate, "PPp")}`} />;
                } else if (isValid(expiryDate) && expiryDate < new Date()) {
                    ephemeralIndicator = <Clock size={12} className="text-muted-foreground opacity-50" title={`Expired`} />;
                }
            } catch (e) {
                 ephemeralIndicator = <Clock size={12} className="text-muted-foreground opacity-50" title={`Invalid expiration`} />;
            }
          }

          return (
            <div
              key={msg.id}
              className={cn(
                'flex items-end space-x-2', 
                isCurrentUser ? 'justify-end' : 'justify-start',
                isFirstInSenderBlock ? 'mt-3' : 'mt-0.5' 
              )}
            >
              {showAvatarAndName && (
                <Avatar className="h-8 w-8 self-end mb-0.5"> 
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${senderInitial}`} alt={msg.senderUsername} data-ai-hint="person avatar"/>
                  <AvatarFallback>{senderInitial}</AvatarFallback>
                </Avatar>
              )}
              {!isCurrentUser && !showAvatarAndName && (
                <div className="w-8 mr-2"></div> 
              )}

              <div
                className={cn(
                  'max-w-xs lg:max-w-md p-2.5 rounded-lg shadow', 
                  isCurrentUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-card-foreground border'
                )}
              >
                {!isCurrentUser && msg.senderUsername && showAvatarAndName && (
                  <p className="text-xs font-medium mb-1 opacity-80">{msg.senderUsername}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.decryptedContent || msg.encryptedContent} 
                  {msg.contentType === 'image' && !msg.decryptedContent && '[Image - Decryption Pending]'}
                  {msg.contentType === 'file' && !msg.decryptedContent && '[File - Decryption Pending]'}
                </p>
                <div className="mt-1 flex items-center space-x-1.5 text-xs opacity-70">
                  {msg.timestamp && msg.timestamp.toDate && isValid(msg.timestamp.toDate()) ? (
                    <span>{format(msg.timestamp.toDate(), 'p')}</span>
                  ) : (
                    <span>Sending...</span> 
                  )}
                  {ephemeralIndicator}
                  {isCurrentUser && msg.status === 'read' && <Eye size={12} title="Read"/>}
                </div>
              </div>
              {isCurrentUser && (
                <div className="w-8 ml-2 h-8"></div> 
              )}
            </div>
          );
        })}
        {filteredMessages.length === 0 && messages.length > 0 && (
          <div className="text-center text-muted-foreground py-10">
            All messages in this chat have expired or been burned.
          </div>
        )}
         {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-10">
            No messages yet. Send one to start the conversation!
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
