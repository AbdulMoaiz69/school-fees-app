"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import type { AuditLog } from "@/lib/supabase/types";

export type LogCategory =
  | "Auth" | "Students" | "Fees" | "Expenses" | "Users" | "Classes" | "Settings" | "Payroll";

/**
 * Record an audit entry. `actor` can be passed when the current user isn't yet
 * resolvable from the session (e.g. during login). Never throws — logging must
 * not break the underlying action.
 */
export async function logAction(
  category: LogCategory,
  action: string,
  details?: string,
  actor?: SessionUser | null
) {
  try {
    const user = actor ?? (await getCurrentUser());
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      user_id: user?.id ?? null,
      user_name: user?.name ?? "System",
      role: user?.role ?? null,
      category,
      action,
      details: details ?? null,
    } as never);
  } catch {
    /* swallow — auditing must never break the action */
  }
}

export async function getAuditLogs(filters?: {
  category?: string;
  userId?: string;
  search?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 500);

  if (filters?.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters?.userId && filters.userId !== "all") query = query.eq("user_id", filters.userId);
  if (filters?.search) query = query.ilike("action", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AuditLog[];
}
