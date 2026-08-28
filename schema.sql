create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz default now()
);

create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id) on delete cascade,
  receiver_id uuid references users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz default now(),
  unique (sender_id, receiver_id)
);

create table friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references users(id) on delete cascade,
  user_b uuid references users(id) on delete cascade,
  streak int not null default 0,
  last_snap_date date,
  created_at timestamptz default now(),
  unique (user_a, user_b)
);

create table chats (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text,
  created_at timestamptz default now()
);

create table chat_members (
  chat_id uuid references chats(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key (chat_id, user_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade,
  sender_id uuid references users(id) on delete cascade,
  content text,
  is_snap boolean not null default false,
  created_at timestamptz default now()
);

create index on chat_members (user_id);
create index on messages (chat_id, created_at);
create index on friend_requests (receiver_id, status);
create index on friendships (user_a);
create index on friendships (user_b);
