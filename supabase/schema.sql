-- =============================================
-- School Fees Management System - Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- GRADES / CLASSES
-- =============================================
create table if not exists grades (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,         -- e.g. "Class 1", "Grade 9"
  monthly_fee numeric(10,2) not null default 0,
  display_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- SETTINGS
-- =============================================
create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  value text not null,
  updated_at timestamptz default now()
);

-- Default settings
insert into settings (key, value) values
  ('late_fee_amount', '200'),
  ('school_name', 'My School'),
  ('school_address', 'School Address Here'),
  ('school_phone', ''),
  ('school_logo', '')
on conflict (key) do nothing;

-- =============================================
-- STUDENTS
-- =============================================
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  registration_number text not null unique,
  full_name text not null,
  grade_id uuid references grades(id) on delete set null,
  parent_name text,
  parent_phone text,
  address text,
  scholarship_type text not null default 'none' check (scholarship_type in ('none', 'half', 'full')),
  is_active boolean not null default true,
  -- Lifecycle: active students have status 'active'; exits set is_active=false
  status text not null default 'active' check (status in ('active', 'expelled', 'withdrawn')),
  exit_reason text,
  exit_date date,
  -- Refundable security deposit collected at admission (held in security treasury)
  security_fee numeric(12,2) not null default 0,
  admission_date date,
  date_of_birth date,
  previous_school text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists students_grade_id_idx on students(grade_id);
create index if not exists students_registration_number_idx on students(registration_number);
create index if not exists students_status_idx on students(status);

-- =============================================
-- FEE CHALLANS
-- =============================================
create table if not exists fee_challans (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null,
  due_date date not null,
  -- Fee components
  tuition_fee numeric(10,2) not null default 0,
  stationary_fee numeric(10,2) not null default 0,
  security_fee numeric(10,2) not null default 0,
  admission_fee numeric(10,2) not null default 0,
  mcs_fee numeric(10,2) not null default 0,
  late_fee numeric(10,2) not null default 0,
  arrears numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,   -- scholarship discount
  total numeric(10,2) not null default 0,
  -- Payment status
  is_paid boolean not null default false,
  paid_at timestamptz,
  paid_by text,
  payment_notes text,
  -- Metadata
  scholarship_type text not null default 'none',
  generated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Each student can have only one challan per month
  unique(student_id, month, year)
);

create index if not exists fee_challans_student_id_idx on fee_challans(student_id);
create index if not exists fee_challans_month_year_idx on fee_challans(month, year);
create index if not exists fee_challans_is_paid_idx on fee_challans(is_paid);

-- =============================================
-- FUNCTION: auto-update updated_at
-- =============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_grades_updated_at before update on grades
  for each row execute function update_updated_at_column();

create trigger update_students_updated_at before update on students
  for each row execute function update_updated_at_column();

create trigger update_fee_challans_updated_at before update on fee_challans
  for each row execute function update_updated_at_column();

-- =============================================
-- FUNCTION: Calculate total for a challan
-- =============================================
create or replace function calculate_challan_total(
  p_tuition numeric,
  p_stationary numeric,
  p_security numeric,
  p_admission numeric,
  p_mcs numeric,
  p_late_fee numeric,
  p_arrears numeric,
  p_discount numeric
) returns numeric as $$
begin
  return greatest(0, p_tuition + p_stationary + p_security + p_admission + p_mcs + p_late_fee + p_arrears - p_discount);
end;
$$ language plpgsql;

-- =============================================
-- ROW LEVEL SECURITY (enable after setup)
-- =============================================
alter table grades enable row level security;
alter table students enable row level security;
alter table fee_challans enable row level security;
alter table settings enable row level security;

-- Allow all authenticated users to read/write (adjust per your auth setup)
create policy "Authenticated users can do everything on grades"
  on grades for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything on students"
  on students for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything on fee_challans"
  on fee_challans for all to authenticated using (true) with check (true);

create policy "Authenticated users can do everything on settings"
  on settings for all to authenticated using (true) with check (true);

-- =============================================
-- SAMPLE DATA (optional - uncomment to insert)
-- =============================================
-- insert into grades (name, monthly_fee, display_order) values
--   ('Nursery', 2500, 1),
--   ('KG', 2800, 2),
--   ('Class 1', 3000, 3),
--   ('Class 2', 3000, 4),
--   ('Class 3', 3200, 5),
--   ('Class 4', 3200, 6),
--   ('Class 5', 3500, 7),
--   ('Class 6', 4000, 8),
--   ('Class 7', 4000, 9),
--   ('Class 8', 4500, 10),
--   ('Class 9', 5000, 11),
--   ('Class 10', 5000, 12);
