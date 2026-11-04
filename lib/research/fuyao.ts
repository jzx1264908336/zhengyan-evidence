import {observations,snapshot,numeric} from './engine.ts';
type Row=Record<string,unknown>;
export type FuyaoComparison={id:string;label:string;period:string;field:string;sourceId:string;page:number;filingValue:number|null;providerValue:number|null;status:'match'|'conflict'|'missing'|'metadata';reason:string};
export type FuyaoCheck={endpoint:string;status:'ok'|'failed';requestId?:string;message:string;comparisons:FuyaoComparison[]};
export type FuyaoReport={status:'unconfigured'|'verified'|'attention'|'failed';fetchedAt:string;snapshot:string;company:string;checks:FuyaoCheck[];message:string};
export const FUYAO_ORIGIN='https://fuyao.aicubes.cn';
export const financialQueries=['income-statements','cash-flow-statements'].flatMap(kind=>['annual','quarterly'].map(period=>({kind,period,endpoint:`/api/a-share/financials/${kind}?thscode=600519.SH&period=${period}&limit=${period==='annual'?3:8}`})));
const date=(ms:unknown)=>typeof ms==='number'&&Number.isFinite(ms)?new Date(ms+8*3600000).toISOString().slice(0,10):'';
export function compareFuyaoRows(items:Row[],kind:string,period:string):FuyaoComparison[]{
 const fields=kind==='income-statements'?{operating_income:'revenue',operating_costs:'cost',net_profit:'totalProfit',parent_holder_net_profit:'parentProfit'}:{act_cash_flow_net:'ocf'};
 const targets=period==='annual'?['2023','2024','2025']:['20259M','20269M'];
 return targets.flatMap(target=>Object.entries(fields).flatMap(([field,suffix])=>{
  const o=observations.find(o=>o.id===target+'-'+suffix);if(!o)return [];
  const end=target.endsWith('9M')?target.slice(0,4)+'-09-30':target+'-12-31';
  const candidates=items.filter(r=>date(r.period_end_ms)===end);
  const row=candidates[0];const raw=row?.[field];const providerValue=typeof raw==='number'&&Number.isFinite(raw)?raw:null;const filingValue=numeric(o);
  const metadata=!!row&&(candidates.length!==1||row.thscode!=='600519.SH'||row.currency!=='CNY'||row.period!==period||row.fiscal_year!==Number(target.slice(0,4))||row.fiscal_period!==(period==='annual'?'FY':'Q3')||!date(row.report_date_ms)||date(row.report_date_ms)>snapshot.asOf);
  const status=metadata?'metadata':!row||filingValue===null||providerValue===null?'missing':Math.abs(providerValue-filingValue)<=0.011?'match':'conflict';
  return [{id:o.id,label:o.label,period:end,field,sourceId:o.sourceId,page:o.page,filingValue,providerValue,status,reason:status==='match'?'同标的、同报告期、人民币元字段一致；不自动认定为单季流量':status==='metadata'?'标的、币种、披露时点或报告元数据不符合冻结研究口径':status==='missing'?'报告或字段缺失，不补零':'数值不同，保留两方来源等待核验'}];
 }));
}
export async function verifyFuyao(key:string|undefined,fetcher:typeof fetch=fetch):Promise<FuyaoReport>{
 const base={fetchedAt:new Date().toISOString(),snapshot:snapshot.version,company:'600519.SH'};
 if(!key?.trim())return {...base,status:'unconfigured',checks:[],message:'扶摇密钥未配置；继续使用已核验公开快照。'};
 const checks:FuyaoCheck[]=[];const deadline=Date.now()+25000;
 for(const query of financialQueries){
  try{
   const r=await fetcher(FUYAO_ORIGIN+query.endpoint,{headers:{'X-api-key':key.trim(),'Accept':'application/json'},redirect:'manual',signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
   if(!r.ok){await r.body?.cancel();throw new Error(r.status===429?'限流，请稍后再试':'上游 HTTP 请求失败')}
   const body=await r.text();if(body.length>2_000_000)throw new Error('上游响应过大');
   const d=JSON.parse(body);if(d.code!==0)throw new Error(d.code===2001?'密钥无效或失效':d.code===2003?'当前账号无此接口权限':d.code===4001?'限流，请稍后再试':'上游业务请求失败');
   if(!d.data||!Array.isArray(d.data.item)||d.data.item.some((r:unknown)=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('上游数据格式无效');
   const comparisons=compareFuyaoRows(d.data.item,query.kind,query.period);
   checks.push({endpoint:query.endpoint,status:'ok',requestId:typeof d.request_id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(d.request_id)?d.request_id:undefined,message:'真实 REST 查询已返回；仅比对所列字段',comparisons});
  }catch(error){
   const known=['限流，请稍后再试','上游 HTTP 请求失败','上游响应过大','密钥无效或失效','当前账号无此接口权限','上游业务请求失败','上游数据格式无效'];
   const message=error instanceof Error&&known.includes(error.message)?error.message:'网络超时或响应解析失败';
   checks.push({endpoint:query.endpoint,status:'failed',message,comparisons:[]});break; // No immediate retry after quota/auth/failure.
  }
 }
 const failed=checks.some(c=>c.status==='failed');const comparisons=checks.flatMap(c=>c.comparisons);
 const status=failed?'failed':comparisons.length>0&&comparisons.every(c=>c.status==='match')?'verified':'attention';
 return {...base,status,checks,message:status==='verified'?`${comparisons.length} 项财务值与原始财报快照一致。结果仅覆盖所列字段，不代表全接口或实时行情已核验。`:status==='failed'?'本次核验未完成；保留公开财报快照，不将失败作为正常结果。':'发现差异、缺失或元数据问题，保留双方来源，未替换研究快照。'};
}
