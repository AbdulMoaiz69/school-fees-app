-- =============================================
-- Migration: Add Date of Birth and Previous School to Students
-- Run this in your Supabase SQL Editor. Idempotent.
-- =============================================

alter table students
  add column if not exists date_of_birth date,
  add column if not exists previous_school text;

notify pgrst, 'reload schema';
