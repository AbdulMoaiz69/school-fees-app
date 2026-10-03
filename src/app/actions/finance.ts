"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { FeeChallan } from "@/lib/supabase/types";
import { MONTHS } from "@/lib/fee-utils";

export type PeriodPoint = {
  key: string;
  label: string;
  generated: number;
  paid: number;
  unpaid: number;
  collected: number;
  expected: number;
  outstanding: number;
  expenses: number;
  net: number; // collected - expenses
};

export type ClassPoint = {
  key: string;
  name: string;
  generated: number;
  paid: number;
  collected: number;
  expected: number;
};

export type FinanceAnalytics = {
  year: number;
  monthly: PeriodPoint[];
  quarterly: PeriodPoint[];
  yearly: PeriodPoint;
  byClass: ClassPoint[];
  components: {
    tuition: number;
    stationary: number;
    security: number;
    admission: number;
    mcs: number;
    lateFee: number;
    arrears: number;
  };
  discountWaived: number;
  avgChallan: number;
  collectionRate: number; // % by count (paid / generated)
  amountRate: number; // % by amount (collected / expected)
  bestMonth: { label: string; collected: number } | null;
  totalExpenses: number;
  netProfit: number; // yearly collected - expenses
  expensesByCategory: { name: string; total: number }[];
  securityTreasury: number;   // sum of security deposits held for active students
  securityStudents: number;   // # active students with a deposit
};

function emptyPoint(key: string, label: string): PeriodPoint {
  return { key, label, generated: 0, paid: 0, unpaid: 0, collected: 0, expected: 0, outstanding: 0, expenses: 0, net: 0 };
}

function accumulate(point: PeriodPoint, c: FeeChallan) {
  point.generated += 1;
  point.expected += c.total;
  if (c.is_paid) {
    point.paid += 1;
    point.collected += c.total;
  } else {
    point.unpaid += 1;
  }
  point.outstanding = point.expected - point.collected;
}

export async function getFinanceAnalytics(year: number): Promise<FinanceAnalytics> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fee_challans")
    .select("*, student:students(grade:grades!students_grade_id_fkey(id, name, display_order))")
    .eq("year", year);
  if (error) throw error;

  const challans = (data ?? []) as unknown as FeeChallan[];

  // Expenses for the same year (by expense_date)
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  // Resilient: if the expenses table doesn't exist yet (migration not run), treat as no expenses.
  const { data: expenseRows } = await admin
    .from("expenses")
    .select("amount, expense_date, category:expense_categories(name)")
    .eq("status", "approved")
    .gte("expense_date", yearStart)
    .lt("expense_date", yearEnd);
  const expenses = (expenseRows ?? []) as unknown as {
    amount: number;
    expense_date: string;
    category: { name: string } | null;
  }[];

  // Security deposit treasury — held for currently active students (resilient if column missing)
  const { data: secRows } = await admin
    .from("students")
    .select("security_fee")
    .eq("is_active", true);
  const secStudents = (secRows ?? []) as unknown as { security_fee: number | null }[];
  const securityTreasury = secStudents.reduce((s, r) => s + Number(r.security_fee ?? 0), 0);
  const securityStudents = secStudents.filter((r) => Number(r.security_fee ?? 0) > 0).length;

  // Monthly buckets (Jan..Dec)
  const monthly: PeriodPoint[] = MONTHS.map((m, i) => emptyPoint(String(i + 1), m.slice(0, 3)));
  // Quarterly buckets
  const quarterly: PeriodPoint[] = [
    emptyPoint("Q1", "Q1 · Jan–Mar"),
    emptyPoint("Q2", "Q2 · Apr–Jun"),
    emptyPoint("Q3", "Q3 · Jul–Sep"),
    emptyPoint("Q4", "Q4 · Oct–Dec"),
  ];
  const yearly = emptyPoint(String(year), String(year));

  const classMap = new Map<string, ClassPoint>();
  const orderMap = new Map<string, number>();
  const components = { tuition: 0, stationary: 0, security: 0, admission: 0, mcs: 0, lateFee: 0, arrears: 0 };
  let discountWaived = 0;

  for (const c of challans) {
    const mIdx = c.month - 1;
    if (mIdx >= 0 && mIdx < 12) accumulate(monthly[mIdx], c);
    const qIdx = Math.floor(mIdx / 3);
    if (qIdx >= 0 && qIdx < 4) accumulate(quarterly[qIdx], c);
    accumulate(yearly, c);

    // Fee components (billed amounts across the year)
    components.tuition += c.tuition_fee ?? 0;
    components.stationary += c.stationary_fee ?? 0;
    components.security += c.security_fee ?? 0;
    components.admission += c.admission_fee ?? 0;
    components.mcs += c.mcs_fee ?? 0;
    components.lateFee += c.late_fee ?? 0;
    components.arrears += c.arrears ?? 0;
    discountWaived += c.discount ?? 0;

    // Per-class breakdown
    const grade = c.student?.grade;
    const key = grade?.id ?? "none";
    const name = grade?.name ?? "No Class";
    if (!classMap.has(key)) {
      classMap.set(key, { key, name, generated: 0, paid: 0, collected: 0, expected: 0 });
      orderMap.set(key, grade?.display_order ?? 9999);
    }
    const cp = classMap.get(key)!;
    cp.generated += 1;
    cp.expected += c.total;
    if (c.is_paid) {
      cp.paid += 1;
      cp.collected += c.total;
    }
  }

  const byClass = [...classMap.values()].sort(
    (a, b) => (orderMap.get(a.key) ?? 9999) - (orderMap.get(b.key) ?? 9999)
  );

  // Bucket expenses into the same periods, then compute net (collected - expenses)
  const expCatMap = new Map<string, number>();
  for (const e of expenses) {
    const mIdx = new Date(e.expense_date).getMonth();
    const amount = Number(e.amount) || 0;
    if (mIdx >= 0 && mIdx < 12) {
      monthly[mIdx].expenses += amount;
      quarterly[Math.floor(mIdx / 3)].expenses += amount;
    }
    yearly.expenses += amount;
    const catName = e.category?.name ?? "Uncategorized";
    expCatMap.set(catName, (expCatMap.get(catName) ?? 0) + amount);
  }
  const expensesByCategory = [...expCatMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
  for (const p of [...monthly, ...quarterly, yearly]) {
    p.net = p.collected - p.expenses;
  }

  const collectionRate = yearly.generated > 0 ? Math.round((yearly.paid / yearly.generated) * 100) : 0;
  const amountRate = yearly.expected > 0 ? Math.round((yearly.collected / yearly.expected) * 100) : 0;
  const avgChallan = yearly.generated > 0 ? Math.round(yearly.expected / yearly.generated) : 0;

  const monthsWithData = monthly.filter((m) => m.generated > 0);
  const bestMonth = monthsWithData.length
    ? monthsWithData.reduce((best, m) => (m.collected > best.collected ? m : best))
    : null;

  return {
    year,
    monthly,
    quarterly,
    yearly,
    byClass,
    components,
    discountWaived,
    avgChallan,
    collectionRate,
    amountRate,
    bestMonth: bestMonth ? { label: bestMonth.label, collected: bestMonth.collected } : null,
    totalExpenses: yearly.expenses,
    netProfit: yearly.net,
    expensesByCategory,
    securityTreasury,
    securityStudents,
  };
}
