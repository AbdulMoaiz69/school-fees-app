"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Student } from "@/lib/supabase/types";
import { generateRegistrationNumber } from "@/lib/fee-utils";
import { requireUser } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";

export async function getStudents(gradeId?: string): Promise<Student[]> {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("*, grade:grades!students_grade_id_fkey(*)")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (gradeId) query = query.eq("grade_id", gradeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Student[];
}

export async function getInactiveStudents(search?: string): Promise<Student[]> {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("*, grade:grades!students_grade_id_fkey(*)")
    .eq("is_active", false)
    .order("exit_date", { ascending: false })
    .order("full_name", { ascending: true });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,registration_number.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Student[];
}

export async function getStudent(id: string): Promise<Student | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*, grade:grades!students_grade_id_fkey(*)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as Student;
}

export async function getSiblings(studentId: string): Promise<Student[]> {
  const supabase = await createClient();
  
  // First get the student to find their sibling_id
  const { data: student } = await supabase
    .from("students")
    .select("sibling_id")
    .eq("id", studentId)
    .single();
  
  if (!student?.sibling_id) return [];
  
  // Find all students who share the same sibling_id OR have this student as their sibling_id
  const { data, error } = await supabase
    .from("students")
    .select("*, grade:grades!students_grade_id_fkey(*)")
    .or(`sibling_id.eq.${student.sibling_id},id.eq.${student.sibling_id}`)
    .neq("id", studentId) // Exclude the current student
    .order("full_name", { ascending: true });
  
  if (error) throw error;
  return (data ?? []) as unknown as Student[];
}

export async function searchStudents(query: string): Promise<Student[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*, grade:grades!students_grade_id_fkey(*)")
    .eq("is_active", true)
    .or(`full_name.ilike.%${query}%,registration_number.ilike.%${query}%`)
    .order("full_name", { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as Student[];
}

export async function createStudent(values: {
  full_name: string;
  grade_id: string;
  parent_name?: string;
  parent_phone?: string;
  address?: string;
  scholarship_type: "none" | "half" | "full" | "sibling" | "custom";
  admission_date?: string;
  date_of_birth?: string;
  previous_school?: string;
  security_fee?: number;
  sibling_id?: string | null;
  custom_discount_pkr?: number;
}) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("students")
    .select("registration_number");
  const existingNumbers = ((existing ?? []) as unknown as { registration_number: string }[]).map(
    (s) => s.registration_number
  );
  const registration_number = generateRegistrationNumber(existingNumbers);

  const payload: Record<string, unknown> = {
    ...values,
    admission_date: values.admission_date?.trim() || null,
    date_of_birth: values.date_of_birth?.trim() || null,
    previous_school: values.previous_school?.trim() || null,
    sibling_id: values.sibling_id ?? null,
    custom_discount_pkr: values.custom_discount_pkr ?? 0,
    character_remarks: null,
    last_promoted_class_id: null,
    certificate_generated_at: null,
    certificate_generated_by: null,
    registration_number,
  };

  const { data, error } = await admin
    .from("students")
    .insert(payload as never)
    .select()
    .single();
  if (error) {
    console.error("Create student error:", error);
    throw error;
  }
  revalidatePath("/students");
  revalidatePath("/dashboard");
  await logAction("Students", "Added student", `${values.full_name} (${registration_number})`);
  return data as unknown as Student;
}

export async function updateStudent(
  id: string,
  values: Partial<{
    full_name: string;
    grade_id: string;
    parent_name: string;
    parent_phone: string;
    address: string;
    scholarship_type: "none" | "half" | "full" | "sibling" | "custom";
    admission_date: string;
    date_of_birth: string | null;
    previous_school: string | null;
    is_active: boolean;
    security_fee: number;
    sibling_id: string | null;
    custom_discount_pkr: number;
  }>
) {
  await requireUser();
  const admin = createAdminClient();
  const payload: Record<string, unknown> = { ...values };
  if ("date_of_birth" in values) {
    payload.date_of_birth = values.date_of_birth?.trim() || null;
  }
  if ("previous_school" in values) {
    payload.previous_school = values.previous_school?.trim() || null;
  }
  if ("admission_date" in values) {
    payload.admission_date = values.admission_date?.trim() || null;
  }

  const { error } = await admin.from("students").update(payload as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/dashboard");
  if (values.full_name) {
    await logAction("Students", "Updated student", values.full_name);
  }
}

export async function deleteStudent(id: string) {
  await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("students")
    .update({ is_active: false } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/students");
  revalidatePath("/dashboard");
}

// =============================================
// Student lifecycle: promote / demote / retain / expel / withdraw
// =============================================

type GradeOrder = { id: string; display_order: number };

async function getGradeLadder(
  supabase: Awaited<ReturnType<typeof createClient>> | Awaited<ReturnType<typeof createAdminClient>>
): Promise<GradeOrder[]> {
  const { data, error } = await supabase
    .from("grades")
    .select("id, display_order")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as GradeOrder[];
}

/** Move a single student up (+1) or down (-1) the class ladder. */
async function moveStudent(id: string, delta: 1 | -1) {
  await requireUser();
  const admin = createAdminClient();
  const { data: student, error: sErr } = await admin
    .from("students")
    .select("grade_id, full_name")
    .eq("id", id)
    .single();
  if (sErr) throw sErr;
  const s = student as unknown as { grade_id: string | null; full_name: string };
  const gradeId = s?.grade_id;
  if (!gradeId) throw new Error("Assign a class to this student before promoting or demoting.");

  const ladder = await getGradeLadder(admin);
  const idx = ladder.findIndex((g) => g.id === gradeId);
  const target = ladder[idx + delta];
  if (!target) {
    throw new Error(delta > 0 ? "Student is already in the highest class." : "Student is already in the lowest class.");
  }

  const { error } = await admin
    .from("students")
    .update({ grade_id: target.id } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/dashboard");
  await logAction("Students", delta > 0 ? "Promoted student" : "Demoted student", s.full_name);
}

export async function promoteStudent(id: string) {
  return moveStudent(id, 1);
}

export async function demoteStudent(id: string) {
  return moveStudent(id, -1);
}

/** Retain keeps the student in their current class — an explicit no-op that re-affirms the class. */
export async function retainStudent(id: string) {
  await requireUser();
  const admin = createAdminClient();
  const { data: student, error: sErr } = await admin
    .from("students")
    .select("grade_id")
    .eq("id", id)
    .single();
  if (sErr) throw sErr;
  const gradeId = (student as unknown as { grade_id: string | null })?.grade_id ?? null;
  // Re-set the same class (no change) so the action succeeds without touching new columns.
  const { error } = await admin
    .from("students")
    .update({ grade_id: gradeId } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
}

export type StudentDues = {
  count: number;
  total: number;
  challans: { id: string; month: number; year: number; total: number }[];
};

/** Returns all unpaid challans for a student (used to block exits with outstanding dues). */
export async function getStudentDues(id: string): Promise<StudentDues> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_challans")
    .select("id, month, year, total")
    .eq("student_id", id)
    .eq("is_paid", false)
    .order("year", { ascending: true })
    .order("month", { ascending: true });
  if (error) throw error;
  const challans = (data ?? []) as unknown as StudentDues["challans"];
  const total = challans.reduce((sum, c) => sum + Number(c.total), 0);
  return { count: challans.length, total, challans };
}

async function exitStudent(id: string, status: "expelled" | "withdrawn", reason: string | null, characterRemarks?: string | null, lastPromotedClassId?: string | null) {
  await requireUser();
  const admin = createAdminClient();

  // Guard: block the exit while any dues are outstanding.
  const dues = await getStudentDues(id);
  if (dues.count > 0) {
    throw new Error(
      `Cannot ${status === "expelled" ? "expel" : "withdraw"} — ${dues.count} unpaid challan(s) totaling Rs ${dues.total.toLocaleString("en-PK")}. Clear all dues first.`
    );
  }

  // Get current grade to use as last_promoted_class if not provided
  const { data: student } = await admin
    .from("students")
    .select("grade_id")
    .eq("id", id)
    .single();

  const updatePayload: Record<string, unknown> = {
    status,
    is_active: false,
    exit_reason: reason?.trim() || null,
    exit_date: new Date().toISOString().split("T")[0],
    character_remarks: characterRemarks?.trim() || null,
    last_promoted_class_id: lastPromotedClassId ?? (student as any)?.grade_id ?? null,
    certificate_generated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("students")
    .update(updatePayload as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/dashboard");
  await logAction("Students", status === "expelled" ? "Expelled student" : "Withdrew student", reason ?? undefined);
}

export async function expelStudent(id: string, reason: string, characterRemarks?: string | null, lastPromotedClassId?: string | null) {
  if (!reason?.trim()) throw new Error("A reason is required to expel a student.");
  return exitStudent(id, "expelled", reason, characterRemarks, lastPromotedClassId);
}

export async function withdrawStudent(id: string, reason?: string, characterRemarks?: string | null, lastPromotedClassId?: string | null) {
  return exitStudent(id, "withdrawn", reason ?? null, characterRemarks, lastPromotedClassId);
}

/** Restore an expelled/withdrawn student to active. */
export async function reinstateStudent(id: string) {
  await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("students")
    .update({ status: "active", is_active: true, exit_reason: null, exit_date: null } as never)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  revalidatePath("/dashboard");
  await logAction("Students", "Reinstated student");
}

/** Promote or demote every active student in a class. Returns how many were moved. */
export async function bulkMoveClass(gradeId: string, delta: 1 | -1): Promise<number> {
  await requireUser();
  const admin = createAdminClient();
  const ladder = await getGradeLadder(admin);
  const idx = ladder.findIndex((g) => g.id === gradeId);
  if (idx === -1) throw new Error("Class not found.");
  const target = ladder[idx + delta];
  if (!target) {
    throw new Error(delta > 0 ? "This is already the highest class — nowhere to promote to." : "This is already the lowest class — nowhere to demote to.");
  }

  const { data, error } = await admin
    .from("students")
    .update({ grade_id: target.id } as never)
    .eq("grade_id", gradeId)
    .eq("is_active", true)
    .select("id");
  if (error) throw error;
  const moved = ((data ?? []) as unknown[]).length;
  revalidatePath("/students");
  revalidatePath("/dashboard");
  await logAction("Students", delta > 0 ? "Bulk promoted a class" : "Bulk demoted a class", `${moved} student(s)`);
  return moved;
}
