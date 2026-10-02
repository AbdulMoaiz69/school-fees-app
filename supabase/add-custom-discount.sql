-- Add custom PKR discount to students table
-- Run this in your Supabase SQL Editor

-- Step 1: Add the new column
alter table students
  add column if not exists custom_discount_pkr numeric(10,2) not null default 0;

-- Step 2: Drop the old check constraint on scholarship_type (whatever it's named)
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'students'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%scholarship_type%';

  if con_name is not null then
    execute 'alter table students drop constraint ' || quote_ident(con_name);
  end if;
end $$;

-- Step 3: Add updated constraint that includes 'custom'
alter table students
  add constraint students_scholarship_type_check
  check (scholarship_type in ('none', 'half', 'full', 'sibling', 'custom'));
