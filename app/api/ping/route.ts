
import { NextResponse } from "next/server";
import { ping } from "@/lib/db";
export async function GET() {
  try { const now = await ping(); return NextResponse.json({ ok: true, now }); }
  catch (e:any) { return NextResponse.json({ ok: false, error: e?.message }, { status: 500 }); }
}
