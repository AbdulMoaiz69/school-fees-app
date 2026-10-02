import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gradeId: string }> }
) {
  const { gradeId } = await params;
  const supabase = await createClient();

  // Fetch students for the grade
  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("*, grade:grades(*)")
    .eq("grade_id", gradeId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Fetch school name from settings
  const { data: settingsRaw } = await supabase.from("settings").select("*");
  const settings = Object.fromEntries(
    ((settingsRaw ?? []) as { key: string; value: string }[]).map((s) => [
      s.key,
      s.value,
    ])
  );

  return NextResponse.json({ students: students ?? [], settings });
}
