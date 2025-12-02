"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (selectedUsers: UserProfile[], groupName?: string) => Promise<void>;
}

export default function CreateChatModal({ isOpen, onClose, onCreateChat }: CreateChatModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const { wickerUser } = useAuth();
  const supabase = createClient();

  const searchUsers = useCallback(async (term: string) => {
    if (!term.trim() || !wickerUser) return;
    setIsLoadingSearch(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', `%${term}%`)
        .not('id', 'eq', wickerUser.id)
        .limit(10);
      
      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setIsLoadingSearch(false);
    }
  }, [wickerUser, supabase]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm) {
        searchUsers(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, searchUsers]);
  
  const handleUserSelect = (user: UserProfile) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  useEffect(() => {
    if (selectedUsers.length > 1) {
        setIsGroupChat(true);
    } else {
        setIsGroupChat(false);
        setGroupName(''); 
    }
  }, [selectedUsers]);

  const handleSubmit = async () => {
    if (isCreatingChat || selectedUsers.length === 0 || (isGroupChat && !groupName.trim())) {
      return;
    }
    setIsCreatingChat(true);
    try {
      await onCreateChat(selectedUsers, isGroupChat ? groupName : undefined);
    } catch (error) {
      console.error("CreateChatModal: Error during onCreateChat call from parent:", error);
    } finally {
      setIsCreatingChat(false); 
    }
  };
  
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedUsers([]);
      setGroupName('');
      setIsGroupChat(false);
      setIsCreatingChat(false); 
      setIsLoadingSearch(false); 
    }
  }, [isOpen]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary font-headline">
            {isGroupChat ? "Create Group Chat" : "Start New Chat"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="search-user"
              placeholder="Search users by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isCreatingChat}
            />
          </div>

          {isLoadingSearch && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          
          {!isLoadingSearch && searchResults.length > 0 && (
            <ScrollArea className="h-[150px] border rounded-md p-2">
              <div className="space-y-2">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded hover:bg-accent/10">
                    <div className="flex items-center space-x-2">
                       <Avatar className="h-8 w-8">
                         <AvatarImage src={`https://placehold.co/40x40.png?text=${user.username.substring(0,1).toUpperCase()}`} alt={user.username} data-ai-hint="person avatar" />
                         <AvatarFallback>{user.username.substring(0,1).toUpperCase()}</AvatarFallback>
                       </Avatar>
                       <Label htmlFor={`user-${user.id}`} className="font-normal">{user.username}</Label>
                    </div>
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.some(u => u.id === user.id)}
                      onCheckedChange={() => handleUserSelect(user)}
                      disabled={isCreatingChat}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
           {!isLoadingSearch && searchTerm && searchResults.length === 0 && (
             <p className="p-4 text-sm text-center text-muted-foreground">No users found matching "{searchTerm}".</p>
           )}
          
          {selectedUsers.length > 0 && (
            <div>
                <Label className="text-sm font-medium">Selected:</Label>
                <div className="flex flex-wrap gap-2 mt-1 p-2 border rounded-md bg-muted/50">
                    {selectedUsers.map(u => (
                        <div key={u.id} className="flex items-center space-x-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                            <span>{u.username}</span>
                            <button onClick={() => !isCreatingChat && handleUserSelect(u)} className="opacity-70 hover:opacity-100" disabled={isCreatingChat}>&times;</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {isGroupChat && (
            <div className="grid gap-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isCreatingChat}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isCreatingChat}>Cancel</Button>
          </DialogClose>
          <Button 
            type="submit" 
            onClick={handleSubmit} 
            disabled={selectedUsers.length === 0 || (isGroupChat && !groupName.trim()) || isCreatingChat} 
            className="bg-primary hover:bg-primary/90"
          >
            {isCreatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isGroupChat ? <Users size={16} className="mr-2"/> : <UserPlus size={16} className="mr-2"/>)}
            {isCreatingChat ? "Creating..." : (isGroupChat ? "Create Group" : "Start Chat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
