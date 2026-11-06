import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { fetchPopularSeries } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(await fetchPopularSeries());
  } catch (error) {
    return readerErrorResponse(error,"Drama rankings are temporarily unavailable");
  }
}
