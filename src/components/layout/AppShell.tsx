
import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserProfileDisplay from '@/components/chat/UserProfileDisplay';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, MessageSquarePlus, Info } from 'lucide-react'; // Added Info icon
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface AppShellProps {
  sidebarContent: ReactNode;
  mainContent: ReactNode;
  onNewChat: () => void;
}

export default function AppShell({ sidebarContent, mainContent, onNewChat }: AppShellProps) {
  const { wickerUser, signOut } = useAuth();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full max-w-xs flex flex-col border-r border-border bg-card shadow-md">
        <header className="p-4 border-b border-border flex justify-between items-center">
          <Link href="/chat" className="text-2xl font-bold text-primary font-headline">
            WickerSphere
          </Link>
          {/* Placeholder for theme toggle or other global actions */}
        </header>
        
        <div className="p-4 border-b border-border">
          <Button onClick={onNewChat} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <MessageSquarePlus size={18} className="mr-2" /> New Chat
          </Button>
        </div>

        <ScrollArea className="flex-grow p-2">
          {sidebarContent}
        </ScrollArea>
        
        <footer className="p-4 border-t border-border">
          {wickerUser && <UserProfileDisplay />}
          <div className="mt-2 grid grid-cols-1 gap-2"> {/* Changed to grid for better button layout */}
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <Settings size={16} className="mr-2" /> Settings
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <Link href="/info">
                <Info size={16} className="mr-2" /> Safety Info
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
              <LogOut size={16} className="mr-2" /> Sign Out
            </Button>
          </div>
        </footer>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {mainContent}
      </main>
    </div>
  );
}
