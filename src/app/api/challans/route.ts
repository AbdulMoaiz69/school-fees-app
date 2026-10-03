import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const supabase = await createClient();
  let query = supabase
    .from("fee_challans")
    .select("*, student:students(*, grade:grades!students_grade_id_fkey(*))")
    .order("created_at", { ascending: false });

  if (month) query = query.eq("month", parseInt(month));
  if (year) query = query.eq("year", parseInt(year));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
