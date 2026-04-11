-- Migration: Add missing columns for branch locations

ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS google_maps_url text;
