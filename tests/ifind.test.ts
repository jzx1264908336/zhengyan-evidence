import test from 'node:test';
import assert from 'node:assert/strict';
import {queryIfind,IFIND_ENDPOINT,IFIND_QUERY,viewIfindText} from '../lib/research/ifind.ts';
import {POST} from '../app/api/ifind/route.ts';
import {ifindFinanceTable} from '../lib/research/ifind-view.ts';
function mock(transform?:(method:string,result:any,id:number)=>Response|undefined){
 const methods:string[]=[];const fetcher:typeof fetch=async(url,init)=>{
  assert.equal(url,IFIND_ENDPOINT);assert.equal(init?.redirect,'manual');const headers=init?.headers as Record<string,string>;assert.equal(headers.Authorization,'private-ifind-token');assert.ok(!('X-api-key' in headers));
  const body=JSON.parse(init?.body as string);methods.push(body.method);if(body.method!=='initialize')assert.equal(headers['Mcp-Session-Id'],'session-secret');
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  const result=body.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{tools:{}}}:body.method==='tools/list'?{tools:[{name:'get_stock_financials'}]}:{content:[{type:'text',text:'贵州茅台年度财报结果，需核对期次和单位。'}]};
  if(body.method==='tools/call'){assert.equal(body.params.name,'get_stock_financials');assert.equal(body.params.arguments.query,IFIND_QUERY)}
  return transform?.(body.method,result,body.id)??Response.json({jsonrpc:'2.0',id:body.id,result},{headers:body.method==='initialize'?{'mcp-session-id':'session-secret'}:{}});
 };return {methods,fetcher};
}
test('iFinD performs authenticated initialize, notification, discovery then fixed finance call',async()=>{
 const m=mock();const r=await queryIfind('private-ifind-token',m.fetcher);assert.equal(r.status,'queried');assert.deepEqual(m.methods,['initialize','notifications/initialized','tools/list','tools/call']);assert.ok(r.text.includes('贵州茅台'));assert.ok(!JSON.stringify(r).includes('session-secret'));assert.ok(!JSON.stringify(r).includes('private-ifind-token'));
});
test('iFinD absent or placeholder token never calls network',async()=>{
 for(const key of ['',undefined,'your mcp key']){let calls=0;const r=await queryIfind(key,async()=>{calls++;throw Error()});assert.equal(r.status,'unconfigured');assert.equal(calls,0)}
});
test('iFinD accepts SSE chunks and ignores notifications before matching response',async()=>{
 const m=mock((method,result,id)=>method==='tools/call'?new Response(new ReadableStream({start(c){const e=new TextEncoder();for(const s of ['event: message\r\ndata: {"jsonrpc":"2.0","method":"logging"}\r\n\r\n','data: '+JSON.stringify({jsonrpc:'2.0',id,result})+'\r\n','\r\n'])c.enqueue(e.encode(s));c.close()}}),{headers:{'content-type':'text/event-stream'}}):undefined);
 assert.equal((await queryIfind('private-ifind-token',m.fetcher)).status,'queried');
});
test('iFinD missing requested tool never invokes tools/call',async()=>{
 const m=mock((method,result,id)=>method==='tools/list'?Response.json({jsonrpc:'2.0',id,result:{tools:[{name:'other_tool'}]}}):undefined);const r=await queryIfind('private-ifind-token',m.fetcher);assert.equal(r.status,'failed');assert.ok(!m.methods.includes('tools/call'));
});
test('iFinD HTTP auth, permissions, rate limits, redirects and network failures fail closed',async()=>{
 for(const status of [401,403,429,302]){let calls=0;const r=await queryIfind('private-ifind-token',async()=>{calls++;return new Response('private-ifind-token',{status})});assert.equal(r.status,'failed');assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('private-ifind-token'))}
 const r=await queryIfind('private-ifind-token',async()=>{throw Error('private-ifind-token')});assert.equal(r.status,'failed');assert.ok(!r.message.includes('private-ifind-token'));
});
test('iFinD requires negotiated session and supported protocol',async()=>{
 for(const mode of ['session','version']){const m=mock((method,result,id)=>method==='initialize'?Response.json({jsonrpc:'2.0',id,result:{...result,protocolVersion:mode==='version'?'1900-01-01':result.protocolVersion}},{headers:mode==='session'?{}:{'mcp-session-id':'session-secret'}}):undefined);assert.equal((await queryIfind('private-ifind-token',m.fetcher)).status,'failed');assert.deepEqual(m.methods,['initialize'])}
});
test('iFinD JSON-RPC errors, mismatched IDs, empty content and tool errors are not usable results',async()=>{
 for(const mode of ['rpc','id','empty','tool']){const m=mock((method,result,id)=>method==='tools/call'?Response.json(mode==='rpc'?{jsonrpc:'2.0',id,error:{message:'private-ifind-token'}}:{jsonrpc:'2.0',id:mode==='id'?999:id,result:mode==='empty'?{content:[]}:mode==='tool'?{...result,isError:true}:result}):undefined);assert.equal((await queryIfind('private-ifind-token',m.fetcher)).status,'failed')}
});
test('iFinD response text redacts token and session before returning to browser',async()=>{
 const m=mock((method,result,id)=>method==='tools/call'?Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:'private-ifind-token session-secret'}]}}):undefined);const r=await queryIfind('private-ifind-token',m.fetcher);assert.equal(r.status,'queried');assert.ok(!JSON.stringify(r).includes('private-ifind-token'));assert.ok(!JSON.stringify(r).includes('session-secret'));
});
test('iFinD HTTP route rejects cross-site and non-JSON before querying upstream',async()=>{
 assert.equal((await POST(new Request('https://example.test/api/ifind',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'}}))).status,403);
 assert.equal((await POST(new Request('https://example.test/api/ifind',{method:'POST'}))).status,415);
});
test('iFinD actual-style wrapper preserves billion abbreviation and MRQ uncertainty',()=>{
 const r=viewIfindText(JSON.stringify({code:1,msg:'success',data:{answer:'|日期|营业收入（单位：元）|\n|20251231|1688.381亿|',indicators_params:{营业收入:{报告期:'最新一期(MRQ)'}}}}));
 assert.ok(r.text.includes('1688.381亿'));assert.equal(r.warnings.length,3);
 assert.throws(()=>viewIfindText(JSON.stringify({code:0,msg:'权限不足',data:null})));
});
test('iFinD display selects named annual fields regardless of provider column order',()=>{
 const t=ifindFinanceTable('|日期|证券代码|单季度.营业收入（单位：元）|经营活动产生的现金流量净额（单位：元）|归属于母公司所有者的净利润（单位：元）|营业收入（单位：元）|\n|---|---|---|---|---|---|\n|20251231|600519.SH|403亿|615.222亿|823.2007亿|1688.381亿|');
 assert.deepEqual(t?.rows[0],['600519.SH','20251231','1688.381亿','823.2007亿','615.222亿']);assert.equal(ifindFinanceTable('不是表格'),null);
});
