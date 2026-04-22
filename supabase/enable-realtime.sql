-- supabase/enable-realtime.sql
-- Run this in your Supabase SQL Editor.
-- This authorizes the database to instantly beam order and ingredient updates directly to your Admin Dashboard.

-- 1. Enable Realtime on the Orders Table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- 2. Enable Realtime on the Ingredients Table (for live stock level viewing)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredients;
