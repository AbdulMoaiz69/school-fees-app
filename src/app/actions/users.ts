"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { hashPin, requireAdmin } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";
import type { AppUser, UserRole } from "@/lib/supabase/types";

export type PublicUser = Omit<AppUser, "pin_hash">;

export async function getUsers(): Promise<PublicUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, name, username, role, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PublicUser[];
}

export async function createUser(values: { name: string; username: string; role: UserRole; pin: string }) {
  await requireAdmin();
  if (!values.name.trim()) throw new Error("Name is required.");
  if (!/^[a-zA-Z0-9_.-]{3,}$/.test(values.username.trim())) throw new Error("Username must be at least 3 characters (letters, numbers, . _ -).");
  if (!/^\d{4,}$/.test(values.pin)) throw new Error("PIN must be at least 4 digits.");

  const admin = createAdminClient();
  const { error } = await admin.from("app_users").insert({
    name: values.name.trim(),
    username: values.username.trim().toLowerCase(),
    role: values.role,
    pin_hash: hashPin(values.pin),
  } as never);
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("That username is already taken.");
    throw error;
  }
  revalidatePath("/users");
  await logAction("Users", "Created user", `${values.name} (@${values.username.trim().toLowerCase()}) · ${values.role}`);
}

export async function updateUserRole(id: string, role: UserRole) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();
  // Prevent removing the last principal/admin's privileges
  if (role === "staff") {
    const { data: admins } = await admin
      .from("app_users")
      .select("id")
      .in("role", ["principal", "admin"])
      .eq("is_active", true);
    const adminIds = ((admins ?? []) as unknown as { id: string }[]).map((a) => a.id);
    if (adminIds.length <= 1 && adminIds.includes(id)) {
      throw new Error("Cannot demote the only remaining admin/principal.");
    }
  }
  const { error } = await admin.from("app_users").update({ role } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/users");
  await logAction("Users", "Changed role", `→ ${role}`, adminUser);
}

export async function setUserActive(id: string, isActive: boolean) {
  const adminUser = await requireAdmin();
  if (adminUser.id === id && !isActive) throw new Error("You cannot deactivate your own account.");
  const admin = createAdminClient();
  const { error } = await admin.from("app_users").update({ is_active: isActive } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/users");
  await logAction("Users", isActive ? "Reactivated user" : "Deactivated user");
}

export async function resetUserPin(id: string, pin: string) {
  await requireAdmin();
  if (!/^\d{4,}$/.test(pin)) throw new Error("PIN must be at least 4 digits.");
  const admin = createAdminClient();
  const { error } = await admin.from("app_users").update({ pin_hash: hashPin(pin) } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/users");
  await logAction("Users", "Reset a user's PIN");
}

export async function updateUserName(id: string, name: string) {
  await requireAdmin();
  if (!name.trim()) throw new Error("Name is required.");
  const admin = createAdminClient();
  const { error } = await admin.from("app_users").update({ name: name.trim() } as never).eq("id", id);
  if (error) throw error;
  revalidatePath("/users");
  await logAction("Users", "Updated user name", `→ ${name.trim()}`);
}
