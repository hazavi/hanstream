import { NextResponse } from "next/server";
import { getSourceConfig } from "@/lib/server-config.mjs";
import {webRuntime,readerNamespace} from '@/lib/deployment';
import {cacheCommand} from '@/lib/persistent-cache';

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if(webRuntime()){
      const heartbeat=await cacheCommand(client=>client.get(readerNamespace()+':heartbeat'));
      if(heartbeat===undefined)throw new Error('Cache unavailable');
      const age=Date.now()-Number(heartbeat);
      return NextResponse.json({status:'ok',role:'web',readerReady:heartbeat!==null&&age>=0&&age<180_000},{headers:{'Cache-Control':'no-store'}});
    }
    getSourceConfig();
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "not_ready", error: "Backend configuration is incomplete." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
