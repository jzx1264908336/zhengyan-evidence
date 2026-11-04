import {obs} from './engine.ts';
export type IfindFieldCheck={id:string;label:string;sourceId:string;page:number;raw:string;normalisedYuan:string|null;filingYuan:string;halfWidthYuan:string|null;unitStatus:'converted'|'conflict'|'unresolved';amountStatus:'compatible'|'conflict'|'unresolved';periodStatus:'matched'|'conflict'|'unresolved';scopeStatus:'matched'|'conflict'|'unresolved';status:'consistent'|'attention'|'conflict';reasons:string[]};
export type IfindValidation={version:'ifind-audit-v1';status:'consistent'|'attention'|'conflict';target:string;entityStatus:'matched'|'conflict'|'unresolved';rowDate:string;fields:IfindFieldCheck[];message:string};
const decimal=(n:bigint,places:number)=>{const sign=n<0n?'-':'';const s=(n<0n?-n:n).toString().padStart(places+1,'0');return sign+s.slice(0,-places)+'.'+s.slice(-places)};
export function parseIfindAmount(raw:string,header:string){
 // A cell's explicit scale wins over a base-unit header. No inferred units, zero filling or floating-point rounding.
 const match=raw.trim().match(/^(-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?)(亿元|万元|亿|万|元)?$/);if(!match)return null;
 const unit=match[2]??header.match(/单位[：:]\s*(亿元|万元|元)/)?.[1];if(!unit)return null;
 const scale=unit==='亿'||unit==='亿元'?8:unit==='万'||unit==='万元'?4:0;
 const literal=match[1].replaceAll(',','');const dp=literal.split('.')[1]?.length??0;if(dp>scale+2)return null;
 const integer=BigInt(literal.replace('.',''));const quantum=10n**BigInt(scale+2-dp),cents=integer*quantum;
 return {cents,quantum,normalisedYuan:decimal(cents,2),halfWidthYuan:decimal(quantum*5n,3),unit};
}
export function validateIfindContent(rawText:string):IfindValidation{
 const base={version:'ifind-audit-v1' as const,target:'600519.SH · 2025-12-31 年度合并报表'};
 let payload:any;try{payload=JSON.parse(rawText)}catch{return {...base,status:'attention',entityStatus:'unresolved',rowDate:'',fields:[],message:'返回不是可识别的结构化信封，停止自动核验。'}}
 if(payload?.code!==1||payload?.msg!=='success')return {...base,status:'attention',entityStatus:'unresolved',rowDate:'',fields:[],message:'供应商业务信封未明确成功，停止自动核验。'};
 const answer=payload?.data?.answer;if(typeof answer!=='string')return {...base,status:'attention',entityStatus:'unresolved',rowDate:'',fields:[],message:'缺少供应商数据表，停止自动核验。'};
 const lines=answer.split('\n').filter(l=>l.trim().startsWith('|'));const cells=(s:string)=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
 const headers=lines[0]?cells(lines[0]):[];const rows=lines.slice(2).map(cells).filter(r=>r.length===headers.length);
 const ci=headers.indexOf('证券代码'),di=headers.indexOf('日期');const candidates=rows.filter(r=>r[ci]==='600519.SH'&&r[di]==='20251231');
 const row=candidates.length===1?candidates[0]:rows.length===1?rows[0]:undefined;
 const entityStatus=!row?'unresolved':row[ci]==='600519.SH'?'matched':'conflict';const rowDate=row?.[di]??'';
 const definitions=[['2025-revenue','营业收入'],['2025-parentProfit','归属于母公司所有者的净利润'],['2025-ocf','经营活动产生的现金流量净额']];
 const fields:IfindFieldCheck[]=definitions.map(([id,label])=>{
  const o=obs(id)!;const indexes=headers.map((h,i)=>{const base=h.match(/^(.+?)[（(]单位[：:]\s*[^）)]+[）)]$/)?.[1]??h;return base.trim()===label?i:-1}).filter(i=>i>=0);
  const index=indexes.length===1?indexes[0]:-1;const raw=row&&index>=0?row[index]:'';const amount=parseIfindAmount(raw,headers[index]??'');
  const expected=parseIfindAmount(o.raw,'单位：元')!;const metadata=payload?.data?.indicators_params?.[label];const params=metadata&&typeof metadata==='object'?JSON.stringify(metadata):'';
  const reasons:string[]=[];
  const unitStatus:IfindFieldCheck['unitStatus']=/美元|港元|USD|HKD|JPY|EUR/.test((headers[index]??'')+params+String(payload?.data?.currency??''))?'conflict':amount?'converted':'unresolved';
  if(unitStatus==='conflict')reasons.push('供应商返回币种与人民币财报不同，禁止直接比较。');
  const rowPeriod=/^20251231$/.test(rowDate)&&candidates.length===1;
  const periodText=String(metadata?.报告期??'').replaceAll(' ','');
  const annual=/^(?:2025年?(?:年报|年度|全年)|2025[-/]?12[-/]?31|FY2025|2025FY)$/i.test(periodText)||(/^(?:年报|年度|全年|FY)$/i.test(periodText)&&String(metadata?.年度)==='2025');
  const explicitYear=periodText.match(/20\d{2}/)?.[0];
  const wrongExplicitPeriod=(explicitYear&&explicitYear!=='2025')||(/20\d{2}[-/]?\d{2}[-/]?\d{2}/.test(periodText)&&periodText.replaceAll('-','').replaceAll('/','')!=='20251231');
  const periodStatus:IfindFieldCheck['periodStatus']=!row||!rowDate?'unresolved':!rowPeriod||wrongExplicitPeriod?'conflict':/最新一期|MRQ|单季|第[一二三四]季度|Q[1-4]/i.test(params)?'unresolved':annual?'matched':'unresolved';
  if(periodStatus==='unresolved')reasons.push(rowPeriod?'数据行日期匹配，但指标参数未明确锁定该年度（或仍为 MRQ/单季），不自动认定期次一致。':'缺少可唯一定位的报告期数据行。');
  if(periodStatus==='conflict')reasons.push(wrongExplicitPeriod?'指标参数的明确年度/期末日期与目标年度冲突。':'数据行公司/报告期不唯一或期末日期不匹配。');
  const scopeStatus:IfindFieldCheck['scopeStatus']=!params?'unresolved':/合并报表/.test(params)?'matched':/母公司报表|单体报表/.test(params)?'conflict':'unresolved';
  if(scopeStatus!=='matched')reasons.push('合并报表口径缺失或冲突。');
  const amountStatus:IfindFieldCheck['amountStatus']=unitStatus==='conflict'||!amount?'unresolved':(amount.cents-expected.cents)*2n<=amount.quantum&&(expected.cents-amount.cents)*2n<=amount.quantum?'compatible':'conflict';
  if(!amount)reasons.push('金额或单位不能安全识别，不补零。');else if(amountStatus==='compatible')reasons.push('元值落在显示精度的半个末位单位区间内；仅为舍入相容，不宣称恢复精确原值。');else reasons.push('金额超出显示精度允许的舍入区间。');
  if(amount&&/亿|万/.test(raw)&&/单位[：:]\s*元/.test(headers[index]))reasons.push('按单元格显式亿/万缩写归一化为元，保留表头与缩写说明。');
  const status=entityStatus==='conflict'||unitStatus==='conflict'||periodStatus==='conflict'||scopeStatus==='conflict'||amountStatus==='conflict'?'conflict':entityStatus==='matched'&&periodStatus==='matched'&&scopeStatus==='matched'&&unitStatus==='converted'&&amountStatus==='compatible'?'consistent':'attention';
  return {id,label,sourceId:o.sourceId,page:o.page,raw,normalisedYuan:unitStatus==='conflict'?null:amount?.normalisedYuan??null,filingYuan:expected.normalisedYuan,halfWidthYuan:unitStatus==='conflict'?null:amount?.halfWidthYuan??null,unitStatus,amountStatus,periodStatus,scopeStatus,status,reasons};
 });
 const status=fields.some(f=>f.status==='conflict')?'conflict':fields.every(f=>f.status==='consistent')?'consistent':'attention';
 return {...base,status,entityStatus,rowDate,fields,message:status==='consistent'?'三项年度字段的单位、舍入区间、期次和合并口径均通过规则核验；不代表供应商全部数据正确。':status==='conflict'?'自动核验发现明确冲突，未将供应商值写入已核验指标。':'已自动核验单位与舍入精度；仍有期次或口径证据不足，保留待核验状态。'};
}
