-- Migration: Create support chats table for native messaging

CREATE TABLE IF NOT EXISTS public.support_chats (
    id uuid default gen_random_uuid() primary key,
    vendor_id uuid references public.vendors(id) on delete cascade not null,
    session_identifier text not null, -- Links to order_number or customer_phone
    sender_type text not null, -- 'customer' or 'admin'
    message text not null,
    is_read boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;

-- Allow insert/select
DO $$ BEGIN
    CREATE POLICY "Allow public insert to support_chats" ON public.support_chats FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public select to support_chats" ON public.support_chats FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Enable Realtime for this table
-- Note: You generally enable it via the Supabase dashboard but this SQL tries to enable it if supersuser allows
alter publication supabase_realtime add table public.support_chats;
