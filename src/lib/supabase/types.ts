export type ScholarshipType = "none" | "half" | "full" | "sibling" | "custom";

export type StudentStatus = "active" | "expelled" | "withdrawn";

export type Grade = {
  id: string;
  name: string;
  monthly_fee: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  registration_number: string;
  full_name: string;
  grade_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  address: string | null;
  scholarship_type: ScholarshipType;
  sibling_id: string | null;
  is_active: boolean;
  status: StudentStatus;
  exit_reason: string | null;
  exit_date: string | null;
  security_fee: number;
  admission_date: string | null;
  date_of_birth: string | null;
  previous_school: string | null;
  custom_discount_pkr: number;
  character_remarks: string | null;
  last_promoted_class_id: string | null;
  certificate_generated_at: string | null;
  certificate_generated_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  grade?: Grade;
  last_promoted_class?: Grade;
};

export type FeeChallan = {
  id: string;
  student_id: string;
  month: number;
  year: number;
  due_date: string;
  tuition_fee: number;
  stationary_fee: number;
  security_fee: number;
  admission_fee: number;
  mcs_fee: number;
  late_fee: number;
  late_fee_note: string | null;
  arrears: number;
  discount: number;
  total: number;
  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
  payment_notes: string | null;
  scholarship_type: ScholarshipType;
  generated_at: string;
  created_at: string;
  updated_at: string;
  // joined
  student?: Student;
};

export type Setting = {
  id: string;
  key: string;
  value: string;
  updated_at: string;
};

export type UserRole = "principal" | "admin" | "staff";

export type AppUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  pin_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  role: string | null;
  category: string;
  action: string;
  details: string | null;
  created_at: string;
};

export type ExpenseStatus = "pending" | "approved" | "rejected";

export type EmployeeType = "teacher" | "staff";

export type Employee = {
  id: string;
  name: string;
  type: EmployeeType;
  designation: string | null;
  phone: string | null;
  monthly_pay: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Payroll = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  employee?: Employee;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  created_at: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  category_id: string | null;
  expense_date: string;
  payment_method: string | null;
  paid_to: string | null;
  notes: string | null;
  recorded_by: string | null;
  status: ExpenseStatus;
  created_by: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined
  category?: ExpenseCategory | null;
};

export type Database = {
  public: {
    Tables: {
      grades: {
        Row: Grade;
        Insert: Omit<Grade, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Grade, "id" | "created_at" | "updated_at">>;
      };
      students: {
        Row: Student;
        Insert: Omit<Student, "id" | "created_at" | "updated_at" | "grade">;
        Update: Partial<
          Omit<Student, "id" | "created_at" | "updated_at" | "grade">
        >;
      };
      fee_challans: {
        Row: FeeChallan;
        Insert: Omit<
          FeeChallan,
          "id" | "created_at" | "updated_at" | "student"
        >;
        Update: Partial<
          Omit<FeeChallan, "id" | "created_at" | "updated_at" | "student">
        >;
      };
      settings: {
        Row: Setting;
        Insert: Omit<Setting, "id" | "updated_at">;
        Update: Partial<Omit<Setting, "id" | "updated_at">>;
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: Omit<ExpenseCategory, "id" | "created_at">;
        Update: Partial<Omit<ExpenseCategory, "id" | "created_at">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at" | "updated_at" | "category">;
        Update: Partial<Omit<Expense, "id" | "created_at" | "updated_at" | "category">>;
      };
    };
  };
};
