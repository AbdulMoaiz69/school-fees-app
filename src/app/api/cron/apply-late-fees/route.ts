import { NextResponse } from "next/server";
import { applyLateFees } from "@/app/actions/fees";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await applyLateFees();
    return NextResponse.json({ 
      success: true, 
      message: `Applied late fees to ${result.updated} challan(s)`,
      ...result 
    });
  } catch (error) {
    console.error("Cron apply late fees failed:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}