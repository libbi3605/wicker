import type { Timestamp } from 'firebase/firestore';

export interface WickerUser {
  uid: string;
  username: string;
  publicKey?: string; // For E2EE
  createdAt: Timestamp;
  lastSeen?: Timestamp;
}

export interface ChatParticipant {
  uid: string;
  username: string;
  publicKey?: string;
}

export interface Chat {
  id: string;
  participants: string[]; // Array of user UIDs
  participantDetails?: ChatParticipant[]; // Optional: denormalized participant info
  isGroupChat: boolean;
  groupName?: string;
  groupAdmins?: string[]; // Array of user UIDs for group admins
  lastMessage?: ChatMessageSnippet;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  typingUsers?: { [uid: string]: string }; // { uid: username }
}

export interface ChatMessageSnippet {
  text?: string;
  senderId?: string;
  timestamp?: Timestamp;
  contentType?: 'text' | 'file' | 'image';
}

export type MessageContentType = 'text' | 'file' | 'image' | 'system';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername?: string; // Denormalized for convenience
  encryptedContent: string; // E2EE message ciphertext
  decryptedContent?: string; // Client-side only, after decryption
  contentType: MessageContentType;
  fileUrl?: string; // For encrypted file content in Firebase Storage
  fileName?: string;
  fileSize?: number;
  timestamp: Timestamp;
  expirationTimestamp?: Timestamp | null;
  isBurnOnRead: boolean;
  readBy?: { [uid: string]: Timestamp }; // Tracks who read and when
  status?: 'sent' | 'delivered' | 'read' | 'error' | 'deleted';
}

// For AI suggestions
export interface EphemeralSettingsSuggestion {
  expirationTimeSuggestion: '1 minute' | '1 hour' | '1 day' | 'never';
  burnOnReadSuggestion: boolean;
  reasoning: string;
}
