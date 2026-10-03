"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Expense, ExpenseCategory } from "@/lib/supabase/types";
import { getCurrentUser, requireUser, requireAdmin, isAdmin } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";
import { formatCurrency } from "@/lib/fee-utils";

// =============================================
// Categories
// =============================================
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ExpenseCategory[];
}

export async function createExpenseCategory(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("expense_categories").insert({ name: trimmed } as never);
  if (error) throw error;
  revalidatePath("/expenses");
  await logAction("Expenses", "Added category", trimmed);
}

export async function updateExpenseCategory(id: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("expense_categories").update({ name: trimmed } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  await logAction("Expenses", "Renamed category", trimmed);
}

export async function deleteExpenseCategory(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  // expenses.category_id is ON DELETE SET NULL, so existing expenses are preserved as "Uncategorized"
  const { error } = await admin.from("expense_categories").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  await logAction("Expenses", "Deleted a category");
}

// =============================================
// Expenses CRUD
// =============================================
export type ExpenseInput = {
  title: string;
  amount: number;
  category_id: string | null;
  expense_date: string;
  payment_method?: string | null;
  paid_to?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
};

export async function getExpenses(filters?: {
  categoryId?: string;
  search?: string;
  month?: number;
  year?: number;
}): Promise<Expense[]> {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("*, category:expense_categories(*)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters?.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters?.year && filters?.month) {
    const start = `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;
    const endMonth = filters.month === 12 ? 1 : filters.month + 1;
    const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("expense_date", start).lt("expense_date", end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Expense[];
}

export async function createExpense(values: ExpenseInput) {
  const user = await requireUser();
  if (!values.title?.trim()) throw new Error("Expense title is required.");
  if (!(values.amount > 0)) throw new Error("Amount must be greater than zero.");

  // Staff-submitted expenses require admin approval before they hit the treasury.
  const admin = isAdmin(user.role);
  const status = admin ? "approved" : "pending";

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("expenses").insert({
    title: values.title.trim(),
    amount: values.amount,
    category_id: values.category_id,
    expense_date: values.expense_date,
    payment_method: values.payment_method ?? null,
    paid_to: values.paid_to?.trim() || null,
    notes: values.notes?.trim() || null,
    recorded_by: values.recorded_by?.trim() || user.name,
    status,
    created_by: user.id,
    created_by_name: user.name,
    approved_by_name: admin ? user.name : null,
    approved_at: admin ? new Date().toISOString() : null,
  } as never);
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  await logAction(
    "Expenses",
    admin ? "Recorded expense" : "Submitted expense for approval",
    `${values.title.trim()} · ${formatCurrency(values.amount)}${admin ? "" : " (pending)"}`
  );
}

export async function approveExpense(id: string) {
  const admin = await requireAdmin();
  const adminClient = createAdminClient();
  const { data: exp } = await adminClient.from("expenses").select("title, amount").eq("id", id).single();
  const { error } = await adminClient.from("expenses").update({
    status: "approved",
    approved_by_name: admin.name,
    approved_at: new Date().toISOString(),
    reject_reason: null,
  } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  const e = exp as unknown as { title: string; amount: number } | null;
  await logAction("Expenses", "Approved expense", e ? `${e.title} · ${formatCurrency(e.amount)}` : undefined);
}

export async function rejectExpense(id: string, reason?: string) {
  const admin = await requireAdmin();
  const adminClient = createAdminClient();
  const { data: exp } = await adminClient.from("expenses").select("title, amount").eq("id", id).single();
  const { error } = await adminClient.from("expenses").update({
    status: "rejected",
    approved_by_name: admin.name,
    approved_at: new Date().toISOString(),
    reject_reason: reason?.trim() || null,
  } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  const e = exp as unknown as { title: string; amount: number } | null;
  await logAction("Expenses", "Rejected expense", e ? `${e.title} · ${formatCurrency(e.amount)}` : undefined);
}

async function assertCanModifyExpense(id: string) {
  const user = await requireUser();
  if (isAdmin(user.role)) return user;
  // Staff may only modify their own still-pending expenses
  const adminClient = createAdminClient();
  const { data } = await adminClient.from("expenses").select("created_by, status").eq("id", id).single();
  const e = data as unknown as { created_by: string | null; status: string } | null;
  if (!e || e.created_by !== user.id || e.status !== "pending") {
    throw new Error("You can only modify your own expenses while they're pending approval.");
  }
  return user;
}

export async function updateExpense(id: string, values: ExpenseInput) {
  await assertCanModifyExpense(id);
  if (!values.title?.trim()) throw new Error("Expense title is required.");
  if (!(values.amount > 0)) throw new Error("Amount must be greater than zero.");
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("expenses").update({
    title: values.title.trim(),
    amount: values.amount,
    category_id: values.category_id,
    expense_date: values.expense_date,
    payment_method: values.payment_method ?? null,
    paid_to: values.paid_to?.trim() || null,
    notes: values.notes?.trim() || null,
    recorded_by: values.recorded_by?.trim() || null,
  } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  await logAction("Expenses", "Edited expense", `${values.title.trim()} · ${formatCurrency(values.amount)}`);
}

export async function deleteExpense(id: string) {
  await assertCanModifyExpense(id);
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("expenses").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  await logAction("Expenses", "Deleted expense");
}

export async function setOpeningBalance(value: number) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("settings")
    .upsert({ key: "opening_balance", value: String(value) } as never, { onConflict: "key" });
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  await logAction("Settings", "Set opening treasury balance", formatCurrency(value));
}

// =============================================
// Treasury & analytics
// =============================================
export type ExpenseAnalytics = {
  openingBalance: number;
  totalIncome: number;       // all fees collected (paid challans)
  totalExpenses: number;     // all expenses
  treasuryBalance: number;   // opening + income - expenses
  thisMonthExpenses: number;
  expenseCount: number;
  byCategory: { name: string; total: number }[];
  monthly: { month: number; label: string; total: number }[];
  year: number;
  pendingCount: number;
  pendingTotal: number;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getExpenseAnalytics(): Promise<ExpenseAnalytics> {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [settingsRes, incomeRes, expensesRes, pendingRes] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "opening_balance").maybeSingle(),
    supabase.from("fee_challans").select("total").eq("is_paid", true),
    // Only APPROVED expenses affect the treasury
    supabase.from("expenses").select("amount, expense_date, category:expense_categories(name)").eq("status", "approved"),
    supabase.from("expenses").select("amount").eq("status", "pending"),
  ]);

  const pending = ((pendingRes.data ?? []) as unknown as { amount: number }[]);
  const pendingCount = pending.length;
  const pendingTotal = pending.reduce((s, e) => s + Number(e.amount), 0);

  const openingBalance = Number((settingsRes.data as unknown as { value: string } | null)?.value ?? 0) || 0;

  const income = ((incomeRes.data ?? []) as unknown as { total: number }[]);
  const totalIncome = income.reduce((s, c) => s + Number(c.total), 0);

  const expenses = ((expensesRes.data ?? []) as unknown as {
    amount: number;
    expense_date: string;
    category: { name: string } | null;
  }[]);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const treasuryBalance = openingBalance + totalIncome - totalExpenses;

  // This month's expenses
  const thisMonthExpenses = expenses
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((s, e) => s + Number(e.amount), 0);

  // By category
  const catMap = new Map<string, number>();
  for (const e of expenses) {
    const name = e.category?.name ?? "Uncategorized";
    catMap.set(name, (catMap.get(name) ?? 0) + Number(e.amount));
  }
  const byCategory = [...catMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  // Monthly trend (current year)
  const monthly = MONTH_ABBR.map((label, i) => ({ month: i + 1, label, total: 0 }));
  for (const e of expenses) {
    const d = new Date(e.expense_date);
    if (d.getFullYear() === year) monthly[d.getMonth()].total += Number(e.amount);
  }

  return {
    openingBalance,
    totalIncome,
    totalExpenses,
    treasuryBalance,
    thisMonthExpenses,
    expenseCount: expenses.length,
    byCategory,
    monthly,
    year,
    pendingCount,
    pendingTotal,
  };
}
