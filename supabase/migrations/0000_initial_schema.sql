-- 0000_initial_schema.sql

-- USERS Table
-- Stores public user information.
create table public.users (
    id uuid not null references auth.users on delete cascade,
    username text not null,
    created_at timestamp with time zone not null default now(),
    last_seen timestamp with time zone,
    primary key (id),
    unique (username)
);
comment on table public.users is 'Public profile information for each user.';
comment on column public.users.id is 'References auth.users.id';

-- CONVERSATIONS Table
-- Stores metadata about each chat.
create table public.conversations (
    id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    is_group_chat boolean not null default false,
    group_name text,
    group_admins uuid[],
    primary key (id)
);
comment on table public.conversations is 'Represents a chat session, either 1-on-1 or group.';


-- CONVERSATION_PARTICIPANTS Table
-- A many-to-many join table between users and conversations.
create table public.conversation_participants (
    conversation_id uuid not null references public.conversations on delete cascade,
    user_id uuid not null references public.users on delete cascade,
    created_at timestamp with time zone not null default now(),
    primary key (conversation_id, user_id)
);
comment on table public.conversation_participants is 'Links users to conversations.';


-- MESSAGES Table
-- Stores all messages for all conversations.
create table public.messages (
    id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    conversation_id uuid not null references public.conversations on delete cascade,
    sender_id uuid not null references public.users on delete cascade,
    sender_username text, -- Denormalized for convenience
    encrypted_content text not null,
    content_type text not null default 'text',
    file_url text,
    file_name text,
    file_size bigint,
    expiration_timestamp timestamp with time zone,
    is_burn_on_read boolean not null default false,
    read_by jsonb,
    status text default 'sent',
    primary key (id)
);
comment on table public.messages is 'Stores encrypted messages for all conversations.';

-- INDEXES
-- Create indexes for performance on frequently queried columns.
create index messages_conversation_id_idx on public.messages (conversation_id);
create index conversation_participants_user_id_idx on public.conversation_participants (user_id);
create index conversation_participants_conversation_id_idx on public.conversation_participants (conversation_id);


-- TRIGGERS
-- A trigger to automatically create a public.users profile when a new user signs up in auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- A trigger to update the updated_at timestamp on the conversation when a new message is inserted.
create or replace function public.update_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_conversation_updated_at();

-- DATABASE FUNCTIONS

-- A function to create a new conversation and add participants.
create or replace function public.create_conversation_and_add_participants(
    p_is_group_chat boolean,
    p_group_name text,
    p_participants uuid[],
    p_group_admins uuid[]
)
returns uuid
language plpgsql
as $$
declare
    new_conversation_id uuid;
    participant_id uuid;
begin
    -- Create the new conversation
    insert into public.conversations (is_group_chat, group_name, group_admins)
    values (p_is_group_chat, p_group_name, p_group_admins)
    returning id into new_conversation_id;

    -- Add all participants to the conversation_participants table
    foreach participant_id in array p_participants
    loop
        insert into public.conversation_participants (conversation_id, user_id)
        values (new_conversation_id, participant_id);
    end loop;
    
    return new_conversation_id;
end;
$$;

-- A function to get all conversations for the currently authenticated user, along with details.
create or replace function public.get_user_conversations_with_details()
returns table (
    id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_group_chat boolean,
    group_name text,
    group_admins uuid[],
    participants json,
    last_message_text text,
    last_message_sender_id uuid,
    last_message_timestamp timestamp with time zone,
    last_message_content_type text
)
language plpgsql
as $$
begin
    return query
    with user_convos as (
        select conversation_id from public.conversation_participants
        where user_id = auth.uid()
    ),
    convo_participants as (
        select
            cp.conversation_id,
            json_agg(json_build_object('user_id', u.id, 'username', u.username)) as participants
        from public.conversation_participants cp
        join public.users u on cp.user_id = u.id
        where cp.conversation_id in (select conversation_id from user_convos)
        group by cp.conversation_id
    ),
    last_messages as (
        select distinct on (conversation_id)
            conversation_id,
            encrypted_content as last_message_text,
            sender_id as last_message_sender_id,
            created_at as last_message_timestamp,
            content_type as last_message_content_type
        from public.messages
        where conversation_id in (select conversation_id from user_convos)
        order by conversation_id, created_at desc
    )
    select
        c.id,
        c.created_at,
        c.updated_at,
        c.is_group_chat,
        c.group_name,
        c.group_admins,
        cp.participants,
        lm.last_message_text,
        lm.last_message_sender_id,
        lm.last_message_timestamp,
        lm.last_message_content_type
    from public.conversations c
    join user_convos uc on c.id = uc.conversation_id
    left join convo_participants cp on c.id = cp.conversation_id
    left join last_messages lm on c.id = lm.conversation_id
    order by c.updated_at desc;
end;
$$;


-- ROW-LEVEL SECURITY (RLS) Policies

-- Enable RLS for all relevant tables
alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- USERS table policies
-- Users can see all other users (for searching).
-- Users can only update their own profile.
create policy "Users are viewable by everyone." on public.users for select using (true);
create policy "Users can update their own profile." on public.users for update using (auth.uid() = id);


-- Helper function to check if a user is a member of a conversation.
create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
security definer
as $$
    select exists (
        select 1
        from public.conversation_participants
        where conversation_id = p_conversation_id and user_id = auth.uid()
    );
$$;

-- CONVERSATIONS table policies
-- Users can only see conversations they are a member of.
create policy "Users can view conversations they are a member of." on public.conversations for select using (public.is_conversation_member(id));
-- Allow insert for authenticated users (the function will handle participant logic).
create policy "Authenticated users can create conversations." on public.conversations for insert with check (auth.role() = 'authenticated');
-- Allow update only by group admins (or members for non-groups - though not much to update there).
create policy "Admins can update group conversations." on public.conversations for update using (
    (is_group_chat = false and public.is_conversation_member(id)) or
    (is_group_chat = true and auth.uid() = any(group_admins))
);

-- CONVERSATION_PARTICIPANTS table policies
-- Users can see participant records for conversations they are a member of.
create policy "Users can view participants of their conversations." on public.conversation_participants for select using (public.is_conversation_member(conversation_id));
-- Allow insert for authenticated users (the function will handle this).
create policy "Authenticated users can be added to conversations." on public.conversation_participants for insert with check (auth.role() = 'authenticated');
-- Allow users to remove themselves. Allow admins to remove others.
create policy "Users can leave conversations, admins can remove users." on public.conversation_participants for delete using (
    (user_id = auth.uid()) or
    (
        select is_group_chat from public.conversations where id = conversation_id
    ) and (
        auth.uid() = any(select group_admins from public.conversations where id = conversation_id)
    )
);

-- MESSAGES table policies
-- Users can only see messages in conversations they are a member of.
create policy "Users can view messages in their conversations." on public.messages for select using (public.is_conversation_member(conversation_id));
-- Users can only insert messages into conversations they are a member of, and must be the sender.
create policy "Users can send messages in their conversations." on public.messages for insert with check (
    public.is_conversation_member(conversation_id) and sender_id = auth.uid()
);
-- Users can only update their own messages (e.g., to mark as read).
create policy "Users can update their own messages." on public.messages for update using (sender_id = auth.uid());
-- Allow users to delete their own messages.
create policy "Users can delete their own messages." on public.messages for delete using (sender_id = auth.uid());
-- Allow deletion for burn-on-read logic (policy might need to be more permissive if handled by a function).
create policy "Allow deletion for burn-on-read" on public.messages for delete using (public.is_conversation_member(conversation_id));

