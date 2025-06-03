
import { MessageCircle } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full items-center justify-center bg-background p-8 text-center">
      <MessageCircle className="h-24 w-24 text-primary/70 mb-6" strokeWidth={1.5} />
      <h1 className="text-3xl font-semibold text-foreground mb-2 font-headline">Welcome to WickerSphere</h1>
      <p className="text-lg text-muted-foreground max-w-md">
        Select a chat from the sidebar to start messaging, or create a new chat to connect with others.
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        All your conversations are end-to-end encrypted.
      </p>
    </div>
  );
}
