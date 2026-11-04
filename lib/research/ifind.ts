import {validateIfindContent,type IfindValidation} from './ifind-validation.ts';
export const IFIND_ENDPOINT='https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp';
export const IFIND_QUERY='查询贵州茅台（600519.SH）2025年年度营业收入、归属于母公司股东的净利润、经营活动产生的现金流量净额。请返回公司代码、报告期、币种、单位和原始数值，不做买卖建议。';
export type IfindReport={status:'unconfigured'|'queried'|'failed';fetchedAt:string;endpoint:string;tool:string;query:string;tools:string[];text:string;rawText?:string;warnings?:string[];validation?:IfindValidation;message:string};
export function viewIfindText(text:string):{text:string;warnings:string[]}{
 let parsed:any;try{parsed=JSON.parse(text)}catch{return {text,warnings:['返回内容未经结构化语义核验，请核对报告期和单位。']}}
 if(parsed&&typeof parsed==='object'&&'code'in parsed&&parsed.msg!=='success')throw Error('iFinD 财务工具业务返回未成功');
 const answer=parsed?.data?.answer;if(typeof answer!=='string'||!answer.trim())throw Error('iFinD 财务工具未返回文本结果');
 const warnings=['仅展示供应商返回材料，未替换原始财报指标。'];
 if(/单位：元/.test(answer)&&/\d(?:\.\d+)?亿/.test(answer))warnings.push('表头标注元，但数据单元格使用亿缩写；数值有舍入，不能当作元级精确原值。');
 if(/最新一期|MRQ/.test(JSON.stringify(parsed?.data?.indicators_params??{})))warnings.push('参数说明含最新一期/MRQ；需与数据行日期及所请求年度逐项核对，不能直接认定口径已一致。');
 return {text:answer+(parsed.data.trade_time_description?'\n\n'+parsed.data.trade_time_description:''),warnings};
}
type Rpc={jsonrpc?:string;id?:number;result?:any;error?:unknown};
async function rpcBody(response:Response,id:number):Promise<Rpc>{
 if(!response.body)throw Error('MCP 响应为空');
 const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',total=0;
 const sse=response.headers.get('content-type')?.includes('text/event-stream');
 try{while(true){const {value,done}=await reader.read();if(value){total+=value.byteLength;if(total>1_000_000)throw Error('MCP 响应超出大小限制');buffer+=decoder.decode(value,{stream:true});}
 if(sse){buffer=buffer.replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;const parsed=JSON.parse(data);if(parsed.id===id)return parsed;}}
 if(done){if(sse)throw Error('MCP 流未返回对应请求');const parsed=JSON.parse(buffer);if(parsed?.id!==id)throw Error('MCP 响应请求编号不匹配');return parsed;}
 }}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function queryIfind(token:string|undefined,fetcher:typeof fetch=fetch):Promise<IfindReport>{
 const base={fetchedAt:new Date().toISOString(),endpoint:IFIND_ENDPOINT,tool:'get_stock_financials',query:IFIND_QUERY};const names:string[]=[];
 if(!token?.trim()||/your.*(?:key|token)/i.test(token))return {...base,status:'unconfigured',tools:[],text:'',message:'iFinD MCP 密钥未配置，未发起请求。'};
 let id=0,session='',protocol='2025-03-26';const deadline=Date.now()+85000;
 async function request(method:string,params?:unknown,notification=false){
  const rid=notification?undefined:++id;
  const headers:Record<string,string>={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':token!.trim()};
  if(session){headers['Mcp-Session-Id']=session;headers['MCP-Protocol-Version']=protocol;}
  const r=await fetcher(IFIND_ENDPOINT,{method:'POST',headers,redirect:'manual',signal:AbortSignal.timeout(Math.max(1,deadline-Date.now())),body:JSON.stringify({jsonrpc:'2.0',...(rid?{id:rid}:{}),method,...(params?{params}:{})})});
  if(!r.ok){await r.body?.cancel();throw Error(r.status===401?'iFinD 密钥无效或失效':r.status===403?'iFinD 权限不足':r.status===429?'iFinD 限流，请稍后重试':'iFinD HTTP 请求失败')}
  if(notification){await r.body?.cancel();return undefined;}
  const result=await rpcBody(r,rid!);if(result.error||result.jsonrpc!=='2.0'||!result.result)throw Error('MCP 返回错误或无效结果');
  if(method==='initialize'){session=r.headers.get('mcp-session-id')??'';if(!session)throw Error('MCP 未返回会话编号');}
  return result.result;
 }
 try{
  const init=await request('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'zhengyan-evidence',version:'0.7.0'}});
  if(!['2025-03-26','2025-06-18','2025-11-25'].includes(init.protocolVersion))throw Error('MCP 协议版本不兼容');protocol=init.protocolVersion;
  await request('notifications/initialized',undefined,true);
  let cursor:string|undefined;
  for(let page=0;page<5;page++){
   const listed=await request('tools/list',cursor?{cursor}:{});if(!Array.isArray(listed.tools))throw Error('MCP 工具目录格式错误');
   for(const t of listed.tools)if(typeof t.name==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(t.name)&&!names.includes(t.name))names.push(t.name);
   if(!listed.nextCursor)break;if(typeof listed.nextCursor!=='string'||listed.nextCursor===cursor)throw Error('MCP 工具分页无效');cursor=listed.nextCursor;
  }
  if(!names.includes(base.tool))throw Error('当前 iFinD 工具目录未开放财务查询');
  const called=await request('tools/call',{name:base.tool,arguments:{query:IFIND_QUERY}});
  if(called.isError)throw Error('iFinD 财务工具调用失败');
  const text=Array.isArray(called.content)?called.content.filter((c:any)=>c.type==='text'&&typeof c.text==='string').map((c:any)=>c.text).join('\n'):'';
  if(!text.trim())throw Error('iFinD 财务工具未返回文本结果');
  // Keep provider content as untrusted plain text, separate from verified metrics and AI prompts.
  const safe=text.split(token.trim()).join('[密钥已隐藏]').split(session).join('[会话已隐藏]');
  const view=viewIfindText(safe);
  return {...base,status:'queried',tools:names,text:view.text.slice(0,24000),rawText:safe.slice(0,24000),warnings:view.warnings,validation:validateIfindContent(safe),message:'已完成 MCP 握手、工具发现与真实财务查询。下方是供应商返回文本，尚未自动映射为已核验指标；需核对公司、期次、单位及原始财报。'+(safe.length>24000?'响应过长，已截取前段。':'')};
 }catch(error){const known=['iFinD 财务工具业务返回未成功','MCP 响应为空','MCP 响应超出大小限制','MCP 流未返回对应请求','MCP 响应请求编号不匹配','iFinD 密钥无效或失效','iFinD 权限不足','iFinD 限流，请稍后重试','iFinD HTTP 请求失败','MCP 返回错误或无效结果','MCP 未返回会话编号','MCP 协议版本不兼容','MCP 工具目录格式错误','MCP 工具分页无效','当前 iFinD 工具目录未开放财务查询','iFinD 财务工具调用失败','iFinD 财务工具未返回文本结果'];return {...base,status:'failed',tools:names,text:'',message:error instanceof Error&&known.includes(error.message)?error.message:'iFinD 网络超时或响应解析失败；未替换已有研究数据。'};}
}
