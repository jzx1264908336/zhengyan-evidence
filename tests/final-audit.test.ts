import test from 'node:test';
import assert from 'node:assert/strict';
import {routeQuestion,selectClaims,buildClaims,metric} from '../lib/research/engine.ts';
import {localAnswerPlan,validateLocalSections} from '../lib/research/local-quality.ts';
import {validateModelResult,interpret} from '../lib/research/ai.ts';

test('Two and three requested dimensions are all covered',()=>{
 assert.deepEqual(localAnswerPlan('请分别分析贵州茅台的估值和行情。').map(s=>s.key),['valuation','price']);
 assert.deepEqual(localAnswerPlan('请分析经营和估值。').map(s=>s.key),['cash','valuation']);
 assert.deepEqual(localAnswerPlan('综合经营、估值和走势。').map(s=>s.key),['cash','valuation','price']);
});
test('Requested price window selects matching deterministic and local evidence',()=>{
 for(const count of [20,60,244]){
  const q=`请分析贵州茅台最近${count}个交易日走势。`;
  const task=routeQuestion(q);assert.equal(task.marketCount,count);
  const claim=selectClaims(task).find(c=>c.id==='C-price')!;
  assert.ok(claim.body.includes(`最近 ${count} 个共同交易日`));
  assert.ok(claim.metrics.every(id=>id.endsWith('-'+count)));
  const plan=localAnswerPlan(q);assert.equal(plan[0].key,'price');
  assert.deepEqual(plan[0].evidenceIds,claim.metrics);
 }
});
test('Unsupported company, year, window and natural day requests stop before model',async()=>{
 for(const q of ['请分析工商银行的经营质量。','请分析000001.SZ的经营。','请分析贵州茅台2024年的现金流。','最近30日走势','最近60天股价']){
  assert.equal(routeQuestion(q).restricted,true,q);assert.deepEqual(localAnswerPlan(q),[]);
  let calls=0;await interpret(q,false,{provider:'ollama'},async()=>{calls++;throw new Error('must not fetch')});assert.equal(calls,0);
 }
});
test('Missing ratio withdraws positive factual conclusion and blocks model',async()=>{
 const m=metric('20269M-cash-ratio')!;const before=m.value;
 try{m.value=null;const c=buildClaims().find(c=>c.id==='C-coverage')!;assert.equal(c.kind,'未验证');assert.equal(c.stance,'unknown');assert.ok(!c.title.includes('高于'));
 let calls=0;const r=await interpret('现金流',false,{provider:'ollama'},async()=>{calls++;throw new Error('must not fetch')});assert.equal(r.status,'failed');assert.equal(calls,0);
 }finally{m.value=before}
});
test('Trade instructions and Chinese numeric claims cannot bypass either validator',()=>{
 for(const text of ['建议加仓持有并等待反弹。','明天一定上涨，可以抄底。','经营现金流增长三倍。','归母净利润增长百分之五十。']){
  assert.throws(()=>validateModelResult({claims:[{text,evidenceIds:['N-cash']}]}),text);
  assert.throws(()=>validateLocalSections({cash:text},localAnswerPlan('现金流')),text);
 }
 assert.doesNotThrow(()=>validateLocalSections({cash:'现金流改善不能直接证明酒类主业改善。'},localAnswerPlan('现金流')));
});
test('Annual report may disclose differences from earlier quarterly data',()=>{
 assert.doesNotThrow(()=>validateLocalSections({peers:'年度报告披露收入确认核算调整，与已披露季度数据存在重大差异；这限制同行可比性，不能据此认定财务造假。'},localAnswerPlan('五粮液收入确认如何比较？')));
});
test('Observed model wording cannot attribute both cash measures to financial subsidiary',()=>{
 assert.throws(()=>validateLocalSections({cash:'最新累计期经营现金流与销售回款的增幅差异明显，且两者变动幅度均受财务公司业务影响。因此不能证明主业改善。'},localAnswerPlan('现金流')));
});
