import {readerImageResponse} from '@/lib/reader-response';
import {parseReaderJob} from '@/lib/reader-protocol';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;
 try{const job=parseReaderJob({kind:'artwork',title:query.get('title'),...(query.get('year')?{year:Number(query.get('year'))}:{}),secondary:query.get('secondary')==='1',width:Number(query.get('width')||320)});return readerImageResponse(job,request);}
 catch{return new Response(null,{status:400,headers:{'Cache-Control':'no-store'}});}
}
