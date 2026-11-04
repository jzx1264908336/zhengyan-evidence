import test from 'node:test';
import assert from 'node:assert/strict';
import {interpret,DEFAULT_MODEL_ENDPOINT,DEFAULT_MODEL_NAME} from '../lib/research/ai.ts';
const valid={claims:[{text:'现金流同比{{9M-ocf-yoy}}，不能直接推出酒类主业改善。',evidenceIds:['9M-ocf-yoy','N-cash']}]};
const completed=(content:unknown=valid)=>({status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:JSON.stringify(content)}]}]});
test('OpenAI Responses uses strict schema, task evidence enum, output budget and no storage',async()=>{
 let calls=0;
 const mock=(async(url,init)=>{calls++;assert.equal(url,DEFAULT_MODEL_ENDPOINT);assert.equal(init?.redirect,'error');const body=JSON.parse(String(init?.body));assert.equal(body.model,DEFAULT_MODEL_NAME);assert.equal(body.store,false);assert.equal(body.max_output_tokens,2200);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);assert.ok(body.text.format.schema.properties.claims.items.properties.evidenceIds.items.enum.includes('N-cash'));assert.ok(!String(init?.body).includes('private-key'));return Response.json(completed())}) as typeof fetch;
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
