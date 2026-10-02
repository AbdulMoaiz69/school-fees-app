"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FeeChallan } from "@/lib/supabase/types";
import { computeDiscount, computeTotal, getDueDate, getMonthName } from "@/lib/fee-utils";
import { requireUser } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";

export async function getChallans(month?: number, year?: number): Promise<FeeChallan[]> {
  const supabase = await createClient();
  let query = supabase
    .from("fee_challans")
    .select("*, student:students(*, grade:grades(*))")
    .order("created_at", { ascending: false });

  if (month) query = query.eq("month", month);
  if (year) query = query.eq("year", year);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as FeeChallan[];
}

export async function getStudentChallans(studentId: string): Promise<FeeChallan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_challans")
    .select("*, student:students(*, grade:grades(*))")
    .eq("student_id", studentId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FeeChallan[];
}

export async function getChallan(id: string): Promise<FeeChallan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_challans")
    .select("*, student:students(*, grade:grades(*))")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as FeeChallan;
}

export async function generateMonthlyFees(month: number, year: number) {
  const supabase = await createClient();

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("*, grade:grades(*)")
    .eq("is_active", true);
  if (studentsError) throw studentsError;

  const dueDate = getDueDate(month, year);

  const challans = ((students ?? []) as unknown as {
    id: string;
    scholarship_type: "none" | "half" | "full" | "sibling" | "custom";
    custom_discount_pkr: number;
    grade: { monthly_fee: number } | null;
  }[]).map((student) => {
    const tuitionFee = student.grade?.monthly_fee ?? 0;
    const discount = computeDiscount(tuitionFee, student.scholarship_type, student.custom_discount_pkr ?? 0);

    const challan = {
      student_id: student.id,
      month,
      year,
      due_date: dueDate.toISOString().split("T")[0],
      tuition_fee: tuitionFee,
      stationary_fee: 0,
      security_fee: 0,
      admission_fee: 0,
      mcs_fee: 0,
      late_fee: 0,
      arrears: 0,
      discount,
      total: 0,
      is_paid: false,
      scholarship_type: student.scholarship_type,
    };

    return { ...challan, total: computeTotal(challan as Parameters<typeof computeTotal>[0]) };
  });

  const { error } = await supabase
    .from("fee_challans")
    .upsert(challans as never, { onConflict: "student_id,month,year", ignoreDuplicates: true });

  if (error) throw error;
  revalidatePath("/fees");
  revalidatePath("/dashboard");
  await logAction("Fees", "Generated monthly fees", `${getMonthName(month)} ${year} · ${challans.length} challans`);
  return challans.length;
}

export async function createChallan(values: {
  student_id: string;
  month: number;
  year: number;
  tuition_fee: number;
  stationary_fee: number;
  security_fee: number;
  admission_fee: number;
  mcs_fee: number;
  arrears?: number;
  scholarship_type: "none" | "half" | "full" | "sibling" | "custom";
  custom_discount_pkr?: number;
}) {
  const supabase = await createClient();
  const dueDate = getDueDate(values.month, values.year);
  const discount = computeDiscount(values.tuition_fee, values.scholarship_type, values.custom_discount_pkr ?? 0);

  const challan = {
    ...values,
    arrears: values.arrears ?? 0,
    late_fee: 0,
    discount,
    due_date: dueDate.toISOString().split("T")[0],
    total: 0,
  };
  challan.total = computeTotal(challan as Parameters<typeof computeTotal>[0]);

  const { data, error } = await supabase
    .from("fee_challans")
    .insert(challan as never)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/fees");
  return data as unknown as FeeChallan;
}

export async function updateChallan(
  id: string,
  values: Partial<{
    stationary_fee: number;
    security_fee: number;
    admission_fee: number;
    mcs_fee: number;
    late_fee: number;
    arrears: number;
  }>
) {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("fee_challans")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const updated = { ...(current as unknown as FeeChallan), ...values };
  const total = computeTotal(updated);

  const { error } = await supabase
    .from("fee_challans")
    .update({ ...values, total } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/fees");
  revalidatePath(`/fees/${id}`);
}

export async function markChallanPaid(
  id: string,
  paidBy: string,
  paymentNotes?: string
) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fee_challans")
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      paid_by: paidBy,
      payment_notes: paymentNotes ?? null,
    } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/fees");
  revalidatePath(`/fees/${id}`);
  revalidatePath("/dashboard");
  await logAction("Fees", "Marked challan paid", `received by ${paidBy}`);
}

export async function markChallanUnpaid(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fee_challans")
    .update({ is_paid: false, paid_at: null, paid_by: null, payment_notes: null } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/fees");
  revalidatePath(`/fees/${id}`);
  revalidatePath("/dashboard");
  await logAction("Fees", "Reverted challan to unpaid");
}

export async function getDashboardStats(month: number, year: number) {
  const supabase = await createClient();

  const [studentsRes, challansRes, scholarshipsRes] = await Promise.all([
    supabase.from("students").select("id", { count: "exact" }).eq("is_active", true),
    supabase
      .from("fee_challans")
      .select("is_paid, total")
      .eq("month", month)
      .eq("year", year),
    supabase
      .from("students")
      .select("scholarship_type")
      .eq("is_active", true)
      .neq("scholarship_type", "none"),
  ]);

  const totalStudents = studentsRes.count ?? 0;
  const challans = ((challansRes.data ?? []) as unknown as { is_paid: boolean; total: number }[]);
  const scholarships = ((scholarshipsRes.data ?? []) as unknown as { scholarship_type: string }[]);

  const paidChallans = challans.filter((c) => c.is_paid);
  const totalCollected = paidChallans.reduce((sum, c) => sum + (c.total ?? 0), 0);
  const totalExpected = challans.reduce((sum, c) => sum + (c.total ?? 0), 0);
  const fullScholarships = scholarships.filter((s) => s.scholarship_type === "full").length;
  const halfScholarships = scholarships.filter((s) => s.scholarship_type === "half").length;
  const customScholarships = scholarships.filter((s) => s.scholarship_type === "custom").length;
  const siblingScholarships = scholarships.filter((s) => s.scholarship_type === "sibling").length;

  return {
    totalStudents,
    totalChallans: challans.length,
    paidCount: paidChallans.length,
    unpaidCount: challans.length - paidChallans.length,
    totalCollected,
    totalExpected,
    fullScholarships,
    halfScholarships,
    customScholarships,
    siblingScholarships,
  };
}
