"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/app/actions/audit";

type SettingRow = { key: string; value: string };

export async function getSettings(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*");
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as unknown as SettingRow[]).map((s) => [s.key, s.value])
  );
}

export async function updateSetting(key: string, value: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("settings")
    .upsert({ key, value } as never, { onConflict: "key" });
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  await logAction("Settings", "Updated a setting", key);
}

export async function updateSettings(settings: Record<string, string>) {
  await requireAdmin();
  const admin = createAdminClient();
  const upserts = Object.entries(settings).map(([key, value]) => ({ key, value }));
  const { error } = await admin
    .from("settings")
    .upsert(upserts as never, { onConflict: "key" });
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  await logAction("Settings", "Updated settings", Object.keys(settings).join(", "));
}
