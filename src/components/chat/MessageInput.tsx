
"use client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatMessage, EphemeralSettingsSuggestion } from '@/lib/types';
import { Send, Sparkles, Clock, Flame, Loader2 } from 'lucide-react'; // Changed Fire to Flame
import { type ChangeEvent, type KeyboardEvent, useState, useRef } from 'react';
import { Textarea } from '../ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { addDays, addHours, addMinutes } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface MessageInputProps {
  onSendMessage: (content: string, ephemeralSettings?: Partial<ChatMessage>) => Promise<void>;
  onSuggestSettings: (messageContent: string) => Promise<EphemeralSettingsSuggestion | null>;
  chatId: string; // Needed for context, e.g., typing indicators
}

export default function MessageInput({ onSendMessage, onSuggestSettings, chatId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  
  const [expirationOption, setExpirationOption] = useState<'never' | '1m' | '1h' | '1d'>('never');
  const [burnOnRead, setBurnOnRead] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    setIsSending(true);

    let expirationTimestamp: Timestamp | null = null;
    const now = new Date();
    if (expirationOption === '1m') expirationTimestamp = Timestamp.fromDate(addMinutes(now, 1));
    else if (expirationOption === '1h') expirationTimestamp = Timestamp.fromDate(addHours(now, 1));
    else if (expirationOption === '1d') expirationTimestamp = Timestamp.fromDate(addDays(now, 1));

    const ephemeralSettings: Partial<ChatMessage> = {
        isBurnOnRead: burnOnRead,
        expirationTimestamp: expirationTimestamp,
    };

    await onSendMessage(message.trim(), ephemeralSettings);
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
    }
    // Reset ephemeral settings to default after sending
    // setExpirationOption('never');
    // setBurnOnRead(false);
    setIsSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleAiButtonClick = async () => {
    if (!message.trim() || isAiSuggesting) return;
    setIsAiSuggesting(true);
    const suggestion = await onSuggestSettings(message.trim());
    if (suggestion) {
        // Apply suggestions
        if (suggestion.expirationTimeSuggestion === '1 minute') setExpirationOption('1m');
        else if (suggestion.expirationTimeSuggestion === '1 hour') setExpirationOption('1h');
        else if (suggestion.expirationTimeSuggestion === '1 day') setExpirationOption('1d');
        else setExpirationOption('never');
        setBurnOnRead(suggestion.burnOnReadSuggestion);
        // Optionally, show a toast with reasoning:
        // toast({ title: "AI Suggestion Applied", description: suggestion.reasoning });
    }
    setIsAiSuggesting(false);
  };

  return (
    <div className="p-4 border-t border-border bg-card shadow- ऊपर">
      <div className="flex items-end space-x-3">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your secure message..."
          className="flex-1 resize-none min-h-[40px] max-h-[120px] rounded-lg p-3 text-sm focus-visible:ring-primary"
          rows={1}
          disabled={isSending}
        />
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" disabled={isSending}>
                    <Clock size={20} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 space-y-4 mb-2">
                <div className="space-y-2">
                    <Label htmlFor="expiration-time">Expiration Time</Label>
                    <Select value={expirationOption} onValueChange={(val: any) => setExpirationOption(val)}>
                        <SelectTrigger id="expiration-time" className="w-[180px]">
                            <SelectValue placeholder="Set expiration" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="1m">1 Minute</SelectItem>
                            <SelectItem value="1h">1 Hour</SelectItem>
                            <SelectItem value="1d">1 Day</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="burn-on-read" checked={burnOnRead} onCheckedChange={setBurnOnRead} />
                    <Label htmlFor="burn-on-read" className="flex items-center">
                        <Flame size={14} className="mr-1 text-orange-500"/> Burn on Read {/* Changed Fire to Flame */}
                    </Label>
                </div>
            </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleAiButtonClick} disabled={isSending || isAiSuggesting || !message.trim()} className="text-muted-foreground hover:text-accent">
                {isAiSuggesting ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="mb-1">
              <p>AI Ephemeral Suggestions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <Button onClick={handleSend} disabled={!message.trim() || isSending} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-5">
          {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </Button>
      </div>
    </div>
  );
}
