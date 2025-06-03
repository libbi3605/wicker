
"use client";
import type { ChatMessage } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Clock, Flame, Eye } from 'lucide-react'; // Changed Fire to Flame
import { useEffect, useRef } from 'react';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUserId: string;
}

export default function ChatWindow({ messages, currentUserId }: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4 bg-background" ref={scrollAreaRef}>
      <div className="space-y-6">
        {messages.map((msg) => {
          const isCurrentUser = msg.senderId === currentUserId;
          const senderInitial = msg.senderUsername?.substring(0, 1).toUpperCase() || '?';
          
          // Basic ephemeral status rendering
          let ephemeralIndicator = null;
          if (msg.isBurnOnRead) {
            ephemeralIndicator = <Flame size={12} className="text-orange-500" title="Burn on read" />; // Changed Fire to Flame
          } else if (msg.expirationTimestamp) {
            const isExpired = msg.expirationTimestamp.toDate() < new Date();
            // For now, expired messages are filtered out by deletion logic (not yet fully implemented)
            // Or simply shown with an indicator if not yet deleted.
            if (!isExpired) {
                ephemeralIndicator = <Clock size={12} className="text-blue-500" title={`Expires ${format(msg.expirationTimestamp.toDate(), "PPp")}`} />;
            } else {
                 ephemeralIndicator = <Clock size={12} className="text-muted-foreground opacity-50" title={`Expired`} />;
            }
          }

          return (
            <div
              key={msg.id}
              className={cn(
                'flex items-end space-x-3',
                isCurrentUser ? 'justify-end' : 'justify-start'
              )}
            >
              {!isCurrentUser && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${senderInitial}`} alt={msg.senderUsername} data-ai-hint="person avatar"/>
                  <AvatarFallback>{senderInitial}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-xs lg:max-w-md p-3 rounded-xl shadow',
                  isCurrentUser
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-card text-card-foreground rounded-bl-none border'
                )}
              >
                {!isCurrentUser && msg.senderUsername && (
                  <p className="text-xs font-medium mb-1 opacity-80">{msg.senderUsername}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.decryptedContent || msg.encryptedContent} 
                  {msg.contentType === 'image' && !msg.decryptedContent && '[Image - Decryption Pending]'}
                  {msg.contentType === 'file' && !msg.decryptedContent && '[File - Decryption Pending]'}
                </p>
                <div className="mt-1.5 flex items-center space-x-2 text-xs opacity-70">
                  <span>{format(msg.timestamp.toDate(), 'p')}</span>
                  {ephemeralIndicator}
                  {/* Basic read status - more complex logic needed for group chats */}
                  {isCurrentUser && msg.status === 'read' && <Eye size={12} title="Read"/>}
                </div>
              </div>
              {isCurrentUser && (
                 <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${senderInitial}`} alt={msg.senderUsername} data-ai-hint="person avatar"/>
                  <AvatarFallback>{senderInitial}</AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
