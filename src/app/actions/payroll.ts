"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";
import { formatCurrency, getMonthName } from "@/lib/fee-utils";
import type { Employee, EmployeeType, Payroll } from "@/lib/supabase/types";

// =============================================
// Employees (teachers & staff)
// =============================================
export async function getEmployees(type?: EmployeeType): Promise<Employee[]> {
  const supabase = await createClient();
  let query = supabase.from("employees").select("*").order("name", { ascending: true });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Employee[];
}

export async function createEmployee(values: {
  name: string;
  type: EmployeeType;
  designation?: string;
  phone?: string;
  monthly_pay: number;
}) {
  await requireAdmin();
  if (!values.name.trim()) throw new Error("Name is required.");
  if (!(values.monthly_pay >= 0)) throw new Error("Pay must be zero or more.");
  const admin = createAdminClient();
  const { error } = await admin.from("employees").insert({
    name: values.name.trim(),
    type: values.type,
    designation: values.designation?.trim() || null,
    phone: values.phone?.trim() || null,
    monthly_pay: values.monthly_pay,
  } as never);
  if (error) throw error;
  revalidatePath("/payroll");
  await logAction("Payroll", `Added ${values.type}`, `${values.name.trim()} · ${formatCurrency(values.monthly_pay)}/mo`);
}

export async function updateEmployee(id: string, values: {
  name?: string;
  designation?: string | null;
  phone?: string | null;
  monthly_pay?: number;
}) {
  await requireAdmin();
  const patch: Record<string, unknown> = {};
  if (values.name !== undefined) patch.name = values.name.trim();
  if (values.designation !== undefined) patch.designation = values.designation?.trim?.() || null;
  if (values.phone !== undefined) patch.phone = values.phone?.trim?.() || null;
  if (values.monthly_pay !== undefined) patch.monthly_pay = values.monthly_pay;
  const admin = createAdminClient();
  const { error } = await admin.from("employees").update(patch as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/payroll");
  await logAction("Payroll", "Updated employee", values.monthly_pay !== undefined ? `pay → ${formatCurrency(values.monthly_pay)}/mo` : undefined);
}

export async function setEmployeeActive(id: string, isActive: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("employees").update({ is_active: isActive } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/payroll");
  await logAction("Payroll", isActive ? "Reactivated employee" : "Deactivated employee");
}

// =============================================
// Payroll (monthly)
// =============================================
export async function getPayrolls(month: number, year: number): Promise<Payroll[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payrolls")
    .select("*, employee:employees(*)")
    .eq("month", month)
    .eq("year", year);
  if (error) throw error;
  return (data ?? []) as unknown as Payroll[];
}

/** Create payroll rows for every active employee for the given month (snapshotting current pay). */
export async function generatePayroll(month: number, year: number): Promise<number> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: emps, error: eErr } = await admin
    .from("employees")
    .select("id, monthly_pay")
    .eq("is_active", true);
  if (eErr) throw eErr;
  const employees = (emps ?? []) as unknown as { id: string; monthly_pay: number }[];
  if (employees.length === 0) return 0;

  const rows = employees.map((e) => ({
    employee_id: e.id,
    month,
    year,
    amount: e.monthly_pay,
    is_paid: false,
  }));
  // Don't overwrite existing rows (keeps edits & paid status)
  const { error } = await admin
    .from("payrolls")
    .upsert(rows as never, { onConflict: "employee_id,month,year", ignoreDuplicates: true });
  if (error) throw error;
  revalidatePath("/payroll");
  await logAction("Payroll", "Generated payroll", `${getMonthName(month)} ${year}`);
  return rows.length;
}

export async function updatePayrollAmount(id: string, amount: number) {
  await requireAdmin();
  if (!(amount >= 0)) throw new Error("Amount must be zero or more.");
  const admin = createAdminClient();
  const { data: current } = await admin.from("payrolls").select("is_paid").eq("id", id).single();
  if ((current as unknown as { is_paid: boolean } | null)?.is_paid) {
    throw new Error("This payslip is already paid — mark it unpaid before changing the amount.");
  }
  const { error } = await admin.from("payrolls").update({ amount } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/payroll");
  await logAction("Payroll", "Adjusted payslip amount", formatCurrency(amount));
}

async function getSalariesCategoryId(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await admin.from("expense_categories").select("id").eq("name", "Salaries").maybeSingle();
  const found = (data as unknown as { id: string } | null)?.id;
  if (found) return found;
  const { data: created } = await admin
    .from("expense_categories")
    .insert({ name: "Salaries" } as never)
    .select("id")
    .single();
  return (created as unknown as { id: string } | null)?.id ?? null;
}

/** Mark a payslip paid — records a Salaries expense in that payroll month. */
export async function markPayrollPaid(id: string) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const { data: p, error: pErr } = await admin
    .from("payrolls")
    .select("*, employee:employees(name, type)")
    .eq("id", id)
    .single();
  if (pErr) throw pErr;
  const payroll = p as unknown as (Payroll & { employee?: { name: string; type: string } });
  if (payroll.is_paid) throw new Error("This payslip is already paid.");

  const empName = payroll.employee?.name ?? "Employee";
  const categoryId = await getSalariesCategoryId(admin);

  // Date within the payroll month so it lands in that month's finance
  const now = new Date();
  const inThisMonth = now.getFullYear() === payroll.year && now.getMonth() + 1 === payroll.month;
  const expenseDate = inThisMonth
    ? now.toISOString().split("T")[0]
    : `${payroll.year}-${String(payroll.month).padStart(2, "0")}-01`;

  const { data: exp, error: exErr } = await admin
    .from("expenses")
    .insert({
      title: `Salary — ${empName} (${getMonthName(payroll.month)} ${payroll.year})`,
      amount: payroll.amount,
      category_id: categoryId,
      expense_date: expenseDate,
      payment_method: "Cash",
      paid_to: empName,
      notes: `Payroll · ${payroll.employee?.type ?? ""}`,
      recorded_by: adminUser.name,
      status: "approved",
      created_by: adminUser.id,
      created_by_name: adminUser.name,
      approved_by_name: adminUser.name,
      approved_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (exErr) throw exErr;
  const expenseId = (exp as unknown as { id: string }).id;

  const { error } = await admin
    .from("payrolls")
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      paid_by: adminUser.name,
      expense_id: expenseId,
    } as never)
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/payroll");
  revalidatePath("/expenses");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  await logAction("Payroll", "Paid salary", `${empName} · ${formatCurrency(payroll.amount)} (${getMonthName(payroll.month)} ${payroll.year})`);
}

/** Reverse a paid payslip — removes the linked Salaries expense. */
export async function markPayrollUnpaid(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: p } = await admin.from("payrolls").select("expense_id").eq("id", id).single();
  const expenseId = (p as unknown as { expense_id: string | null } | null)?.expense_id;
  if (expenseId) {
    await admin.from("expenses").delete().eq("id", expenseId);
  }
  const { error } = await admin
    .from("payrolls")
    .update({ is_paid: false, paid_at: null, paid_by: null, expense_id: null } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/payroll");
  revalidatePath("/expenses");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  await logAction("Payroll", "Reversed salary payment");
}
