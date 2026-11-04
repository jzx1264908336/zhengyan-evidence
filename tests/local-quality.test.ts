import test from 'node:test';
import assert from 'node:assert/strict';
import {localAnswerPlan,validateLocalSections} from '../lib/research/local-quality.ts';
test('Multi-dimension answer cannot omit, duplicate or add a section',()=>{
 const plan=localAnswerPlan('先看估值，再看股价，最后看经营；每项分别说证据和未知。');
 assert.deepEqual(plan.map(s=>s.key),['cash','valuation','price']);
 assert.throws(()=>validateLocalSections({cash:'现金流改善不能直接证明主业改善。',valuation:'估值倍数不能证明低估。'},plan));
 assert.throws(()=>validateLocalSections({cash:'现金流改善不能直接证明主业改善。',valuation:'估值倍数不能证明低估。',price:'股价上涨不能证明公告因果。',extra:'多余内容'},plan));
 const result=validateLocalSections({cash:'现金流改善不能直接证明酒类主业改善。',valuation:'估值倍数不能单独证明公司被低估。',price:'股价相对基准上涨不能证明公告的因果。'},plan);
 assert.equal(result.claims.length,3);assert.ok(result.claims[2].evidenceIds.includes('sh000300-return-20'));
});
test('Scope answer must explicitly distinguish minority interest',()=>{
 const plan=localAnswerPlan('我能把归属于母公司股东的利润当成合并净利润吗？');
 assert.equal(plan[0].key,'scope');
 assert.throws(()=>validateLocalSections({scope:'合并经营现金流比较需要结合财务公司影响。',cash:'现金流改善不能证明主业改善。'},plan));
 assert.doesNotThrow(()=>validateLocalSections({scope:'归母净利润不包含少数股东损益，而合并净利润包含；不能混用两种分母。',cash:'现金流改善不能证明酒类主业改善。'},plan));
});
test('Unsupported anomaly and cash-flow causal claims are rejected',()=>{
 assert.throws(()=>validateLocalSections({peers:'收入确认调整导致数据异常，因此必须排除。'},localAnswerPlan('五粮液收入确认调整如何比较？')));
 assert.throws(()=>validateLocalSections({cash:'销售回款同比也受财务公司资金变化影响。'},localAnswerPlan('现金流改善了吗？')));
 assert.doesNotThrow(()=>validateLocalSections({peers:'收入确认核算调整是可比性限制，而非数据异常或公司异常。'},localAnswerPlan('五粮液收入确认调整如何比较？')));
 assert.throws(()=>validateLocalSections({peers:'收入确认核算调整导致季度数据出现重大差异。'},localAnswerPlan('五粮液收入确认调整如何比较？')));
 assert.doesNotThrow(()=>validateLocalSections({peers:'收入确认核算调整仅影响年度可比性，不得推断季度数据异常或差异严重程度。'},localAnswerPlan('五粮液收入确认调整如何比较？')));
});
test('Program assigns evidence per section rather than accepting invented model citations',()=>{
 const plan=localAnswerPlan('PB权益时点滞后为什么重要？');
 assert.equal(plan[0].key,'valuation');
 const result=validateLocalSections({valuation:'市净率使用最近披露权益，报告期滞后需要保留。'},plan);
 assert.deepEqual(result.claims[0].evidenceIds,['market-pe-ttm','market-pb']);
 assert.throws(()=>validateLocalSections({valuation:'市净率使用最近披露权益，报告期滞后需要保留。',evidenceIds:['invented']},plan));
});
test('Quarterly revisions and annual peer comparability use separate evidence',()=>{
 const plan=localAnswerPlan('五粮液报告更新会影响同行比较吗？');assert.deepEqual(plan.map(s=>s.key),['revision','peers']);
 assert.ok(plan[0].evidenceIds.includes('wly2025q3original-revenue-value'));assert.ok(plan[0].evidenceIds.includes('wly2025q3updated-ocf-value'));assert.ok(!plan[1].evidenceIds.some(id=>id.startsWith('wly2025q3')));
});
test('Semantic regressions reject unsupported shared causes and unordered drawdown',()=>{
 assert.throws(()=>validateLocalSections({cash:'两者均受财务公司业务影响，因此现金流改善不能证明主业改善。'},localAnswerPlan('现金流改善了吗？')));
 assert.throws(()=>validateLocalSections({price:'股价最大回撤是从最高点到最低点的跌幅，不能证明公告因果。'},localAnswerPlan('最大回撤如何理解？')));
 assert.doesNotThrow(()=>validateLocalSections({price:'股价最大回撤从此前高点到随后低点计算，保留先后顺序，不能证明公告因果。'},localAnswerPlan('最大回撤如何理解？')));
});
