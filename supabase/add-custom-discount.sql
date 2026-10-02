-- Add custom PKR discount to students table
-- Run this in your Supabase SQL Editor

alter table students
  add column if not exists custom_discount_pkr numeric(10,2) not null default 0;

-- Also update the scholarship_type check constraint to allow 'custom'
alter table students
  drop constraint if exists students_scholarship_type_check;

alter table students
  add constraint students_scholarship_type_check
  check (scholarship_type in ('none', 'half', 'full', 'sibling', 'custom'));
