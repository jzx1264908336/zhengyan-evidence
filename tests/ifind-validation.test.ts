import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseIfindAmount,validateIfindContent} from '../lib/research/ifind-validation.ts';
const fixture=JSON.parse(readFileSync(new URL('../docs/ifind-verification.json',import.meta.url),'utf8')).rawText;
function data(){return JSON.parse(fixture)}
function lock(d:any){for(const key of ['营业收入','归属于母公司所有者的净利润','经营活动产生的现金流量净额'])d.data.indicators_params[key]={单位:'元',报表类型:'合并报表',报告期:'2025年年度'};return d}
test('iFinD amount exact decimal converts yi, wan, yuan and grouping without float math',()=>{
 for(const [raw,header,yuan,width] of [['1688.381亿','单位：元','168838100000.00','50000.000'],['823.2007亿元','单位：元','82320070000.00','5000.000'],['1.25万','单位：元','12500.00','50.000'],['-1.25','单位：万元','-12500.00','50.000'],['1,234.56','单位：元','1234.56','0.005']]){const p=parseIfindAmount(raw,header)!;assert.equal(p.normalisedYuan,yuan);assert.equal(p.halfWidthYuan,width)}
});
test('iFinD amount unsupported units, missing, malformed grouping and excessive precision are not zero',()=>{
 for(const raw of ['--','null','','NaN','Infinity','1,23.00元','1.2%','1.234元','1e8元'])assert.equal(parseIfindAmount(raw,'单位：元'),null,raw);
 assert.equal(parseIfindAmount('100','未知单位'),null);
});
test('Actual iFinD sample is rounding-compatible but MRQ period remains unresolved',()=>{
 const r=validateIfindContent(fixture);assert.equal(r.status,'attention');assert.equal(r.fields.length,3);assert.ok(r.fields.every(f=>f.amountStatus==='compatible'&&f.unitStatus==='converted'&&f.periodStatus==='unresolved'&&f.scopeStatus==='matched'));
 assert.equal(r.fields[0].filingYuan,'168838102514.79');assert.equal(r.fields[0].normalisedYuan,'168838100000.00');
});
test('Explicit annual metadata plus matching rows permits a qualified consistent result',()=>{
 const r=validateIfindContent(JSON.stringify(lock(data())));assert.equal(r.status,'consistent');assert.ok(r.fields.every(f=>f.status==='consistent'));assert.ok(r.fields[0].reasons.some(x=>x.includes('不宣称恢复精确原值')));
});
test('Out-of-rounding interval is a conflict even when annual metadata matches',()=>{
 const d=lock(data());d.data.answer=d.data.answer.replace('1688.381亿','1688.382亿');const r=validateIfindContent(JSON.stringify(d));assert.equal(r.status,'conflict');assert.equal(r.fields[0].amountStatus,'conflict');
});
test('One cent mismatch at explicit cent precision does not pass',()=>{
 const d=lock(data());d.data.answer=d.data.answer.replace('1688.381亿','168838102514.80元');assert.equal(validateIfindContent(JSON.stringify(d)).fields[0].amountStatus,'conflict');
});
test('Wrong company or date conflicts independently of matching amounts',()=>{
 for(const [before,after] of [['600519.SH','000001.SZ'],['20251231','20250930']]){const d=lock(data());d.data.answer=d.data.answer.replace(before,after);assert.equal(validateIfindContent(JSON.stringify(d)).status,'conflict')}
});
test('Missing and duplicate rows do not choose an arbitrary version',()=>{
 const d=lock(data());d.data.answer+='\n'+d.data.answer.split('\n')[2];assert.notEqual(validateIfindContent(JSON.stringify(d)).status,'consistent');
 d.data.answer='';assert.equal(validateIfindContent(JSON.stringify(d)).status,'attention');
});
test('Missing amount and conflicting reporting scope cannot become verified',()=>{
 const d=lock(data());d.data.answer=d.data.answer.replace('1688.381亿','--');assert.equal(validateIfindContent(JSON.stringify(d)).fields[0].unitStatus,'unresolved');
 const e=lock(data());e.data.indicators_params.营业收入.报表类型='母公司报表';assert.equal(validateIfindContent(JSON.stringify(e)).fields[0].scopeStatus,'conflict');
});
test('Foreign currency cannot compare directly with yuan filings',()=>{
 const d=lock(data());d.data.indicators_params.营业收入.币种='USD';const r=validateIfindContent(JSON.stringify(d));assert.equal(r.status,'conflict');assert.equal(r.fields[0].unitStatus,'conflict');assert.equal(r.fields[0].normalisedYuan,null);assert.equal(r.fields[0].amountStatus,'unresolved');
});
test('Missing metadata and quarterly parameters retain uncertainty despite correct date',()=>{
 for(const metadata of [{},{年度:'2025',季度:'第一季度',报表类型:'合并报表'},{年度:'2025',季度:'第四季度',报表类型:'合并报表'}]){const d=lock(data());d.data.indicators_params.营业收入=metadata;assert.equal(validateIfindContent(JSON.stringify(d)).fields[0].periodStatus,'unresolved')}
});
test('Plain text and malformed envelopes never claim consistency',()=>{
 assert.equal(validateIfindContent('not json').status,'attention');assert.equal(validateIfindContent('{}').status,'attention');
});
test('Explicit conflicting metadata year/date cannot pass despite a correct table date',()=>{
 for(const period of ['2024年年度','2025-09-30']){const d=lock(data());d.data.indicators_params.营业收入.报告期=period;assert.equal(validateIfindContent(JSON.stringify(d)).fields[0].periodStatus,'conflict')}
});
test('Failed supplier envelope cannot be promoted by a plausible table',()=>{
 const d=lock(data());d.code=0;d.msg='denied';const r=validateIfindContent(JSON.stringify(d));assert.equal(r.status,'attention');assert.equal(r.fields.length,0);
});
