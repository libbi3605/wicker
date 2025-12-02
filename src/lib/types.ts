import type { User as SupabaseUser } from '@supabase/supabase-js';

// Combining Supabase user with our custom profile data
export interface UserProfile {
  id: string; // UUID from auth.users
  username: string;
  created_at: string;
  last_seen?: string;
}

export type WickerUser = SupabaseUser & { user_profile: UserProfile };


export interface ConversationParticipant {
  user_id: string;
  username: string;
}

export interface Conversation {
  id: string; // UUID
  is_group_chat: boolean;
  group_name?: string;
  group_admins?: string[];
  created_at: string;
  updated_at: string;
  // For UI display
  participants?: ConversationParticipant[]; 
  last_message_text?: string;
  last_message_timestamp?: string;
  last_message_sender_id?: string;
  last_message_content_type?: string;
}

export type MessageContentType = 'text' | 'file' | 'image' | 'system';

export interface Message {
  id: string; // UUID
  conversation_id: string;
  sender_id: string;
  sender_username?: string; // Denormalized for convenience
  encrypted_content: string; // E2EE message ciphertext
  decryptedContent?: string; // Client-side only, after decryption
  content_type: MessageContentType;
  file_url?: string;
  file_name?: string;
t file_size?: number;
  created_at: string;
  expiration_timestamp?: string | null;
  is_burn_on_read: boolean;
  read_by?: { [uid: string]: string }; // Tracks who read and when
  status?: 'sent' | 'delivered' | 'read' | 'error';
}


// For AI suggestions
export interface EphemeralSettingsSuggestion {
  expirationTimeSuggestion: '1 minute' | '1 hour' | '1 day' | 'never';
  burnOnReadSuggestion: boolean;
  reasoning: string;
}

// For database function returns
export interface CreateChatResponse {
  conversation_id: string;
}
