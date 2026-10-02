-- =============================================
-- Migration: Withdrawal / Expulsion Certificate
-- Run this in your Supabase SQL Editor. Idempotent.
-- =============================================

-- Add columns to students table for withdrawal certificate data
alter table students
  add column if not exists character_remarks text,
  add column if not exists last_promoted_class_id uuid references grades(id) on delete set null,
  add column if not exists certificate_generated_at timestamptz,
  add column if not exists certificate_generated_by text;

-- Add index for last_promoted_class
create index if not exists students_last_promoted_class_id_idx on students(last_promoted_class_id);

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';