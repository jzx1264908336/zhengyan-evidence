import test from 'node:test';
import assert from 'node:assert/strict';
import {compareFuyaoRows,financialQueries,verifyFuyao} from '../lib/research/fuyao.ts';
import {observations,numeric} from '../lib/research/engine.ts';
import {POST} from '../app/api/fuyao/route.ts';
const ms=(date:string)=>Date.parse(date+'T00:00:00+08:00');
function rows(kind:string,period:string){return (period==='annual'?['2023','2024','2025']:['20259M','20269M']).map(target=>{
 const row:Record<string,unknown>={thscode:'600519.SH',currency:'CNY',fiscal_year:Number(target.slice(0,4)),fiscal_period:period==='annual'?'FY':'Q3',period,report_date_ms:ms('2026-10-31'),period_end_ms:ms(target.endsWith('9M')?target.slice(0,4)+'-09-30':target+'-12-31')};
 for(const [field,suffix] of Object.entries(kind==='income-statements'?{operating_income:'revenue',operating_costs:'cost',net_profit:'totalProfit',parent_holder_net_profit:'parentProfit'}:{act_cash_flow_net:'ocf'}))row[field]=numeric(observations.find(o=>o.id===target+'-'+suffix));return row;
});}
test('Fuyao configured key uses fixed HTTPS host and documented auth, four sequential queries',async()=>{
 let count=0;const report=await verifyFuyao('private-test-key',async(url,init)=>{
  assert.equal(String(url),'https://fuyao.aicubes.cn'+financialQueries[count].endpoint);assert.equal(init?.redirect,'manual');assert.equal((init?.headers as Record<string,string>)['X-api-key'],'private-test-key');
  const q=financialQueries[count++];return Response.json({code:0,request_id:'test-id',data:{item:rows(q.kind,q.period)}});
 });assert.equal(count,4);assert.equal(report.status,'verified');assert.equal(report.checks.flatMap(c=>c.comparisons).length,23);assert.ok(!JSON.stringify(report).includes('private-test-key'));
});
test('Fuyao without key never requests network',async()=>{let calls=0;const r=await verifyFuyao('',async()=>{calls++;throw Error()});assert.equal(r.status,'unconfigured');assert.equal(calls,0)});
test('Fuyao null, empty, differing and duplicate rows do not become normal facts',()=>{
 const data=rows('cash-flow-statements','annual');data[0].act_cash_flow_net=null;data[1].act_cash_flow_net=0;const r=compareFuyaoRows(data,'cash-flow-statements','annual');assert.equal(r[0].status,'missing');assert.equal(r[1].status,'conflict');assert.equal(r[2].status,'match');
 assert.ok(compareFuyaoRows([],'cash-flow-statements','annual').every(c=>c.status==='missing'));
 assert.equal(compareFuyaoRows([data[2],data[2]],'cash-flow-statements','annual')[2].status,'metadata');
});
test('Fuyao wrong currency, security or future disclosure remains unverified',()=>{
 for(const patch of [{currency:'USD'},{thscode:'000001.SZ'},{report_date_ms:ms('2026-11-05')},{fiscal_period:'Q1'}]){const data=rows('income-statements','quarterly');Object.assign(data[0],patch);assert.equal(compareFuyaoRows(data,'income-statements','quarterly')[0].status,'metadata')}
});
test('Fuyao auth, permissions and throttling fail once without leaking provider body',async()=>{
 for(const code of [2001,2003,4001,9999]){let calls=0;const r=await verifyFuyao('test-key',async()=>{calls++;return Response.json({code,message:'test-key secret body',data:null})});assert.equal(r.status,'failed');assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('secret body'))}
});
test('Fuyao HTTP redirect, 429, malformed JSON and network failure fail closed',async()=>{
 for(const f of [async()=>new Response('',{status:302}),async()=>new Response('',{status:429}),async()=>new Response('{bad'),async()=>{throw Error('test-key')}]){const r=await verifyFuyao('test-key',f);assert.equal(r.status,'failed');assert.ok(!JSON.stringify(r).includes('test-key'))}
});
test('Fuyao successful envelope with absent fields needs attention',async()=>{
 const r=await verifyFuyao('test-key',async()=>Response.json({code:0,data:{item:[]}}));assert.equal(r.status,'attention');assert.ok(r.checks.flatMap(c=>c.comparisons).every(c=>c.providerValue===null));
});
test('Fuyao endpoint rejects cross-origin and non-JSON calls before upstream',async()=>{
 assert.equal((await POST(new Request('https://example.test/api/fuyao',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'}}))).status,403);
 assert.equal((await POST(new Request('https://example.test/api/fuyao',{method:'POST'}))).status,415);
});
