import {readerImageResponse} from '@/lib/reader-response';
import {parseReaderJob} from '@/lib/reader-protocol';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;
 try{const job=parseReaderJob({kind:'portrait',name:query.get('name'),...(query.get('key')?{key:query.get('key')}:{}),width:Number(query.get('width')||160)});return readerImageResponse(job,request);}
 catch{return new Response(null,{status:400,headers:{'Cache-Control':'no-store'}});}
}
