import {queryIfind} from '../../../lib/research/ifind.ts';
import {allowRequest} from '../../../lib/research/guard.ts';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'不接受跨站请求'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'需要 JSON 请求'},{status:415});
 if(!allowRequest('ifind-'+(request.headers.get('cf-connecting-ip')??'local')))return Response.json({error:'请求较频繁，请稍后再试'},{status:429});
 const report=await queryIfind(process.env.IFIND_MCP_TOKEN);return Response.json(report,{headers:{'Cache-Control':'no-store'}});
}
