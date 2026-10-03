"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Grade } from "@/lib/supabase/types";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";

export async function getGrades(): Promise<Grade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Grade[];
}

export async function getGrade(id: string): Promise<Grade | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grades")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as Grade;
}

export async function createGrade(values: {
  name: string;
  monthly_fee: number;
  display_order: number;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("grades").insert(values as never);
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/students");
  await logAction("Classes", "Added class", values.name);
}

export async function updateGrade(
  id: string,
  values: { name?: string; monthly_fee?: number; display_order?: number }
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("grades").update(values as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/students");
  revalidatePath("/fees");
  await logAction("Classes", "Updated class", values.name);
}

export async function deleteGrade(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("grades").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/students");
  await logAction("Classes", "Deleted a class");
}
