import test from 'node:test';
import assert from 'node:assert/strict';
import {interpret,DEFAULT_MODEL_ENDPOINT,DEFAULT_MODEL_NAME,configFromEnvironment,normalizeLocalNumbers} from '../lib/research/ai.ts';
const valid={claims:[{text:'现金流同比{{9M-ocf-yoy}}，不能直接推出酒类主业改善。',evidenceIds:['9M-ocf-yoy','N-cash']}]};
const completed=(content:unknown=valid)=>({status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:JSON.stringify(content)}]}]});
test('OpenAI Responses uses strict schema, task evidence enum, output budget and no storage',async()=>{
 let calls=0;
 const mock=(async(url,init)=>{calls++;assert.equal(url,DEFAULT_MODEL_ENDPOINT);assert.equal(init?.redirect,'manual');const body=JSON.parse(String(init?.body));assert.equal(body.model,DEFAULT_MODEL_NAME);assert.equal(body.store,false);assert.equal(body.max_output_tokens,2200);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);assert.ok(body.text.format.schema.properties.claims.items.properties.evidenceIds.items.enum.includes('N-cash'));assert.ok(!String(init?.body).includes('private-key'));return Response.json(completed())}) as typeof fetch;
 const result=await interpret('现金流改善了吗',false,{key:'private-key'},mock);
 assert.equal(calls,1);assert.equal(result.status,'verified');assert.ok(result.claims[0].text.includes('120.07%'));
});
test('OpenAI refusal, incomplete response and unrelated references fail closed',async()=>{
 const responses=[{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'declined'}]}]},{...completed(),status:'incomplete'},completed({claims:[{text:'不相关结论',evidenceIds:['not-in-packet']}]}),completed({claims:[{text:'增长99%',evidenceIds:['N-cash']}]})];
 for(const body of responses){const mock=(async()=>Response.json(body)) as typeof fetch;const result=await interpret('现金流改善了吗',false,{key:'test'},mock);assert.equal(result.status,'failed');assert.deepEqual(result.claims,[])}
});
test('Quota failures give actionable status without leaking provider response',async()=>{
 for(const code of ['credit_balance_exhausted','insufficient_quota']){const mock=(async()=>Response.json({error:{code,message:'DO_NOT_LEAK'}},{status:429})) as typeof fetch;const result=await interpret('现金流改善了吗',false,{key:'test'},mock);assert.equal(result.status,'failed');assert.ok(result.message.includes('额度不足'));assert.ok(!JSON.stringify(result).includes('DO_NOT_LEAK'))}
});
test('Unsupported endpoints and restricted questions make no model request',async()=>{
 let calls=0;const mock=(async()=>{calls++;return Response.json(completed())}) as typeof fetch;
 for(const endpoint of ['http://api.openai.com/v1/responses','https://name:password@api.openai.com/v1/responses','https://api.openai.com/unknown'])assert.equal((await interpret('现金流',false,{key:'test',endpoint},mock)).status,'failed');
 await interpret('明天是否满仓买入',false,{key:'test'},mock);assert.equal(calls,0);
});
test('Network failure and malformed JSON do not emit fabricated claims',async()=>{
 for(const mock of [(async()=>{throw new Error('network')}) as typeof fetch,(async()=>new Response('not-json')) as typeof fetch]){const result=await interpret('现金流',false,{key:'test'},mock);assert.equal(result.status,'failed');assert.deepEqual(result.claims,[])}
});
test('Ollama local inference needs no key and never forwards a supplied cloud key',async()=>{
 const mock=(async(url,init)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(new Headers(init?.headers).has('Authorization'),false);const body=JSON.parse(String(init?.body));assert.equal(body.think,false);assert.equal(body.stream,false);assert.equal(body.model,'qwen3.5:9b');assert.equal(body.format.additionalProperties,false);return Response.json({done:true,done_reason:'stop',message:{content:JSON.stringify({cash:'现金流增长不能直接证明酒类主业改善，仍需拆分财务公司影响。'})}})}) as typeof fetch;
 for(const key of [undefined,'real-cloud-key-must-not-leak']){const result=await interpret('现金流',false,{provider:'ollama',key},mock);assert.equal(result.status,'verified');assert.ok(result.message.includes('本地 Ollama'))}
});
test('Ollama rejects non-loopback addresses, other ports and redirects',async()=>{
 let calls=0;const mock=(async()=>{calls++;return Response.json({})}) as typeof fetch;
 for(const endpoint of ['http://192.168.1.1:11434/api/chat','http://localhost:11434/api/chat','http://127.0.0.1:80/api/chat','https://example.test/api/chat','http://127.0.0.1:11434/api/chat?x=1'])assert.equal((await interpret('现金流',false,{provider:'ollama',endpoint},mock)).status,'failed');
 assert.equal(calls,0);
});
test('Ollama empty, truncated and invented-number results are rejected',async()=>{
 for(const body of [{done:false},{done:true,done_reason:'length',message:{content:JSON.stringify(valid)}},{done:true,message:{content:JSON.stringify({claims:[{text:'增长999%',evidenceIds:['N-cash']}]})}}]){const mock=(async()=>Response.json(body)) as typeof fetch;const result=await interpret('现金流',false,{provider:'ollama'},mock);assert.equal(result.status,'failed');assert.deepEqual(result.claims,[])}
});
test('Local mode ignores stale cloud endpoint, model name and credentials',()=>{
 const config=configFromEnvironment({MODEL_PROVIDER:'ollama',MODEL_ENDPOINT:'https://api.openai.com/v1/responses',MODEL_NAME:'cloud-model',MODEL_API_KEY:'secret'});
 assert.deepEqual(config,{provider:'ollama',endpoint:'http://127.0.0.1:11434/api/chat',model:'qwen3.5:9b'});
});

test('Provider redirects fail without following or releasing model output',async()=>{
 let calls=0;const mock=(async(_url,init)=>{calls++;assert.equal(init?.redirect,'manual');return new Response(null,{status:302,headers:{location:'http://untrusted.test'}})}) as typeof fetch;
 assert.equal((await interpret('现金流',false,{provider:'ollama'},mock)).status,'failed');assert.equal(calls,1);
});
test('Local prose rejects Chinese decimal bypass and malformed benchmark naming',async()=>{
 for(const text of ['比值为一点二六倍','表现优于沪深 三十指数']){const mock=(async()=>Response.json({done:true,done_reason:'stop',message:{content:JSON.stringify({claims:[{text,evidenceIds:['N-cash']}]})}})) as typeof fetch;assert.equal((await interpret('现金流',false,{provider:'ollama'},mock)).status,'failed')}
});

test('Chinese ratio is recoverable only when matching a cited computed metric',()=>{
 assert.deepEqual(normalizeLocalNumbers({claims:[{text:'比值为一点二六倍',evidenceIds:['20269M-cash-ratio']}]}),{claims:[{text:'比值为{{20269M-cash-ratio}}',evidenceIds:['20269M-cash-ratio']}]});
 assert.throws(()=>normalizeLocalNumbers({claims:[{text:'比值为一点九九倍',evidenceIds:['20269M-cash-ratio']}]}));
 assert.throws(()=>normalizeLocalNumbers({claims:[{text:'比值为一点二六倍',evidenceIds:['N-cash']}]}));
});
test('Local validation may repair once, but cannot silently fall back to rules',async()=>{
 let calls=0;const mock=(async()=>{calls++;return Response.json({done:true,done_reason:'stop',message:{content:JSON.stringify(calls===1?{cash:'增长999%'}:{cash:'现金流增长不能证明主业改善，需保留财务公司影响。'})}})}) as typeof fetch;
 const result=await interpret('现金流',false,{provider:'ollama'},mock);assert.equal(result.status,'verified');assert.equal(calls,2);assert.ok(result.message.includes('一次校验修正'));
 let invalidCalls=0;const invalid=(async()=>{invalidCalls++;return Response.json({done:true,message:{content:'{}'}})}) as typeof fetch;
 const failed=await interpret('现金流',false,{provider:'ollama'},invalid);assert.equal(invalidCalls,2);assert.equal(failed.status,'failed');assert.deepEqual(failed.claims,[]);
});
