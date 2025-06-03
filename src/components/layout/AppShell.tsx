
"use client";

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Settings, MessageSquarePlus, Info, Menu } from 'lucide-react';
import Image from 'next/image';

import { ScrollArea } from '@/components/ui/scroll-area';
import UserProfileDisplay from '@/components/chat/UserProfileDisplay';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppShellProps {
  sidebarContent: ReactNode;
  mainContent: ReactNode;
  onNewChat: () => void;
}

export default function AppShell({ sidebarContent, mainContent, onNewChat }: AppShellProps) {
  const { wickerUser, signOut } = useAuth();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const SidebarInstance = ({ isSheetInstance = false }: { isSheetInstance?: boolean }) => (
    <>
      <header className="p-4 border-b border-sidebar-border flex items-center">
        <Link 
          href="/chat" 
          className="flex items-center space-x-2 text-2xl font-bold text-primary font-headline"
          onClick={() => {
            if (isSheetInstance) setMobileSheetOpen(false);
          }}
        >
          <Image src="/logo.png" alt="Wicker Logo" width={32} height={32} />
          <span>Wicker</span>
        </Link>
      </header>
      
      <div className="p-4 border-b border-sidebar-border">
        <Button 
          onClick={() => { 
            onNewChat(); 
            if (isSheetInstance) setMobileSheetOpen(false);
          }} 
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <MessageSquarePlus size={18} className="mr-2" /> New Chat
        </Button>
      </div>

      <ScrollArea className="flex-grow p-2">
        {sidebarContent}
      </ScrollArea>
      
      <footer className="p-4 border-t border-sidebar-border">
        {wickerUser && <UserProfileDisplay />}
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/20">
            <Settings size={16} className="mr-2" /> Settings
          </Button>
          <Button 
            asChild 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/20" 
            onClick={() => {
              if (isSheetInstance) setMobileSheetOpen(false);
            }}
          >
            <Link href="/info">
              <Info size={16} className="mr-2" /> Safety Info
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/20" 
            onClick={() => { 
              signOut(); 
              if (isSheetInstance) setMobileSheetOpen(false);
            }}
          >
            <LogOut size={16} className="mr-2" /> Sign Out
          </Button>
        </div>
      </footer>
    </>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {!isMobile && (
        <aside className="w-full max-w-xs flex flex-col border-r border-border bg-sidebar shadow-md">
          <SidebarInstance />
        </aside>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {isMobile && (
          <div className="p-3 border-b border-border md:hidden flex items-center sticky top-0 bg-sidebar z-10 shadow-sm">
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2 text-primary">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-4/5 max-w-xs flex flex-col bg-sidebar border-r border-sidebar-border">
                <SidebarInstance isSheetInstance={true} />
              </SheetContent>
            </Sheet>
            <Link href="/chat" className="flex items-center space-x-2 text-lg font-semibold text-primary font-headline">
                <Image src="/logo.png" alt="Wicker Logo" width={24} height={24} />
                <span>Wicker</span>
            </Link>
          </div>
        )}
        {mainContent}
      </main>
    </div>
  );
}
