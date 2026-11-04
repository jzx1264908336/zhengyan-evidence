import { interpret,configFromEnvironment } from '../../../lib/research/ai.ts';
import { routeQuestion,selectClaims,snapshot } from '../../../lib/research/engine.ts';
import { allowRequest } from '../../../lib/research/guard.ts';
export async function POST(request:Request){
 if(!allowRequest(request.headers.get('oai-authenticated-user-id')??request.headers.get('cf-connecting-ip')??'local'))return Response.json({error:'请求较频繁，请稍后重试'},{status:429,headers:{'Retry-After':'60'}});
 if(Number(request.headers.get('content-length')??0)>8192)return Response.json({error:'请求过大'},{status:413});
 const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)return Response.json({error:'不接受跨站请求'},{status:403});
 try{
  const text=await request.text();if(text.length>4096)return Response.json({error:'请求过大'},{status:413});
  const body=JSON.parse(text);if(typeof body.question!=='string'||body.question.trim().length<2||body.question.length>400)return Response.json({error:'请输入 2—400 字的研究问题'},{status:400});
  if(body.snapshot && body.snapshot!==snapshot.version)return Response.json({error:'数据快照已变化，请刷新后重试'},{status:409});
  const task=routeQuestion(body.question);const challenge=body.challenge===true;
  // Production model calls are opt-in. No provider credentials are sent to the client.
  const ai=task.restricted?{status:'unconfigured',summary:'',claims:[],message:task.explanation}:await interpret(body.question,challenge,configFromEnvironment(process.env));
  return Response.json({task,claims:selectClaims(task,challenge),ai,snapshot:snapshot.version,generatedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'请求格式无效，请重试'},{status:400});}
}
