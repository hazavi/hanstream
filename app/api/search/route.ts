import {readerErrorResponse} from '@/lib/reader-response';
import { NextResponse } from "next/server";
import { fetchSearch } from "@/lib/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });
  try {
    return NextResponse.json(await fetchSearch(query, Number(url.searchParams.get("page")) || 1));
  } catch (error) {
    return readerErrorResponse(error,"Search is temporarily unavailable");
  }
}
