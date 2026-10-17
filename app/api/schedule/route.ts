import { NextResponse } from "next/server";
import { fetchSchedule } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(await fetchSchedule());
  } catch (error) {
    console.error("Drama schedule failed:", error);
    return NextResponse.json({ error: "Schedule is temporarily unavailable" }, { status: 502 });
  }
}
