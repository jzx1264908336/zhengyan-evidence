import raw from './snapshot.json' with { type: 'json' };
import supplement from './supplement.json' with {type:'json'};
import {marketData,marketWindow} from './market-analysis.ts';
import type { Observation, Source, FilingNote, Claim, Metric, ResearchTask } from './types.ts';

export const snapshot = {...raw,version:'research-20261104-v2'};
export const observations = [...raw.observations,...supplement.observations] as Observation[];
export const notes = raw.notes as FilingNote[];
export const sources = [...raw.sources,...supplement.sources] as Source[];
export const filingObservationCount=observations.filter(o=>sources.find(s=>s.id===o.sourceId)?.kind!=='market').length;
export {marketData,marketWindow};
export const revisionVersions=supplement.versions;
export const dimensions = ['经营质量','财务趋势','估值','行情特征','行业位置','重要事件','风险'];
export const obs = (id:string) => observations.find(o=>o.id===id);

export function parseCents(value:string|null):bigint|null {
  if(value===null || !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/.test(value)) return null;
  const clean=value.replaceAll(',',''); const neg=clean.startsWith('-');
  const [whole,fraction='']=clean.replace('-','').split('.');
  const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  return neg?-cents:cents;
}
export function numeric(o:Observation|undefined):number|null {
  if(!o) return null;
  if(o.unit==='percent')return Number(o.raw.replaceAll(',',''))/100;
  if(o.unit==='price'||o.unit==='index')return /^\d+(\.\d+)?$/.test(o.raw)?Number(o.raw):null;
  const cents=parseCents(o.raw);return cents===null?null:Number(cents)/100;
}
export const value=(id:string)=>numeric(obs(id));
export function yoy(current:number|null,base:number|null):number|null {return current===null||base===null||base<=0?null:current/base-1;}
export function ratio(a:number|null,b:number|null):number|null{return a===null||b===null||b<=0?null:a/b;}
export function ttm(annual:number|null,current:number|null,prior:number|null):number|null {return annual===null||current===null||prior===null?null:annual+current-prior;}
export function singleQuarter(current:number|null,previous:number|null,kind:'flow'|'stock'='flow') {return kind==='stock'||current===null||previous===null?null:current-previous;}
export function median(values:(number|null)[]):number|null {const xs=values.filter((v):v is number=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b); if(xs.length<3)return null;const n=xs.length;return n%2?xs[(n-1)/2]:(xs[n/2-1]+xs[n/2])/2;}
export function maxDrawdown(prices:number[]):number|null {if(!prices.length||prices.some(p=>!Number.isFinite(p)||p<=0))return null;let peak=prices[0],drawdown=0;for(const price of prices){peak=Math.max(peak,price);drawdown=Math.min(drawdown,price/peak-1);}return drawdown;}
export function format(v:number|null,unit='percent',digits=2):string {if(v===null||!Number.isFinite(v))return '—';if(unit==='percent')return (v*100).toFixed(digits)+'%';if(unit==='CNY')return (v/1e8).toFixed(digits);return v.toFixed(digits);}

export function buildMetrics():Metric[] {
 const result:Metric[]=[];
 const growth=(id:string,label:string,a:string,b:string)=>result.push({id,label,value:yoy(value(a),value(b)),unit:'percent',formula:'本期 ÷ 上年同期 − 1（仅正基数）',inputs:[a,b]});
 for(const year of ['2024','2025']){
  const prior=String(Number(year)-1);
  growth(year+'-revenue-yoy',year+' 营业收入同比',year+'-revenue',prior+'-revenue');
  growth(year+'-profit-yoy',year+' 归母净利润同比',year+'-parentProfit',prior+'-parentProfit');
  growth(year+'-ocf-yoy',year+' 经营现金流同比',year+'-ocf',prior+'-ocf');
 }
 for(const [field,label] of [['revenue','营业收入'],['parentProfit','归母净利润'],['ocf','经营现金流'],['salesCash','销售回款']])growth('9M-'+field+'-yoy','2026 前三季度'+label+'同比','20269M-'+field,'20259M-'+field);
 for(const period of ['2024','2025','20259M','20269M']){
  const a=period+'-revenue',b=period+'-cost',c=period+'-ocf',d=period+'-totalProfit';
  const margin=ratio(value(b),value(a));
  result.push({id:period+'-margin',label:period+' 营业收入毛利率',value:margin===null?null:1-margin,unit:'percent',formula:'（营业收入 − 匹配营业成本）÷ 营业收入',inputs:[a,b]});
  result.push({id:period+'-cash-ratio',label:period+' 经营现金流 / 合并净利润',value:ratio(value(c),value(d)),unit:'times',formula:'合并经营现金流 ÷ 合并净利润（含少数股东损益）',inputs:[c,d]});
 }
 for(const field of ['revenue','parentProfit','ocf'])result.push({id:'ttm-'+field,label:'截至 2026 三季报 TTM '+field,value:ttm(value('2025-'+field),value('20269M-'+field),value('20259M-'+field)),unit:'CNY',formula:'2025 全年 + 2026 前三季度 − 2025 前三季度',inputs:['2025-'+field,'20269M-'+field,'20259M-'+field]});
 const a=value('20269M-bank'),b=value('20259M-bank');
 result.push({id:'bank-delta',label:'同业存放现金流出项目同比变化',value:a===null||b===null?null:a-b,unit:'CNY',formula:'本期现金流出项目 − 上期现金流出项目；负数表示流出减少',inputs:['20269M-bank','20259M-bank']});
 for(const code of ['000568.SZ','600809.SH','000858.SZ'])for(const [field,suffix] of [['revenue','revenue'],['parentProfit','profit']])growth(code+'-'+suffix+'-yoy','2025 同比',code+'-2025-'+field,code+'-2024-'+field);
 const cap='sh600519-market-cap';
 const profitInputs=['2025-parentProfit','20269M-parentProfit','20259M-parentProfit'];
 result.push({id:'market-pe-ttm',label:'市盈率 PE TTM',value:ratio(value(cap),ttm(...profitInputs.map(value) as [number|null,number|null,number|null])),unit:'times',formula:'2026-11-04 供应商总市值 ÷（2025 归母净利 + 2026 前三季度归母净利 − 2025 前三季度归母净利）',inputs:[cap,...profitInputs]});
 result.push({id:'market-pb',label:'市净率 PB（最近报告权益）',value:ratio(value(cap),value('20269M-equity')),unit:'times',formula:'2026-11-04 供应商总市值 ÷ 2026-09-30 归母所有者权益；分子分母时点不同，明确披露滞后',inputs:[cap,'20269M-equity']});
 for(const [symbol,prefix] of [['sh600519',''],['sz000568','000568.SZ-'],['sh600809','600809.SH-'],['sz000858','000858.SZ-']])result.push({id:symbol+'-pe-fy2025',label:'2025 年静态市盈率（非 TTM）',value:ratio(value(symbol+'-market-cap'),value(prefix+'2025-parentProfit')),unit:'times',formula:'2026-11-04 供应商总市值 ÷ 2025 年归母净利润；不是滚动或预测市盈率',inputs:[symbol+'-market-cap',prefix+'2025-parentProfit']});
 for(const count of [20,60,244]){const w=marketWindow(count);for(const [symbol,stats,label] of [['sh600519',w.stockStats,'贵州茅台'],['sh000300',w.benchmarkStats,'沪深300']] as const){result.push({id:`${symbol}-return-${count}`,label:label+' 最近 '+count+' 个共同交易日区间价格表现',value:stats.returnValue,unit:'percent',formula:'区间终点收盘值 ÷ 起点收盘值 − 1；个股使用供应商前复权价格，指数使用点位，不宣称现金分红再投资总回报',inputs:[symbol+'-close-'+stats.start.date,symbol+'-close-'+stats.end.date]});result.push({id:`${symbol}-drawdown-${count}`,label:label+' 区间最大回撤',value:stats.drawdown,unit:'percent',formula:'逐点扫描历史峰值，取 min(价格 ÷ 截至当日峰值 − 1)；下面列出最差峰谷对',inputs:[symbol+'-close-'+stats.peak.date,symbol+'-close-'+stats.trough.date]})}}
 for(const version of supplement.versions){
  const versionLabel=version.supersedes?'更新版':'原始版';
  result.push({id:version.id+'-margin',label:'五粮液 2025 前三季度'+versionLabel+'归母净利润 / 收入',value:ratio(value(version.id+'-profit'),value(version.id+'-revenue')),unit:'percent',formula:'同一版本的归母净利润 ÷ 同一版本营业收入；只是归母口径比值，不替代合并销售净利率',inputs:[version.id+'-profit',version.id+'-revenue']});
  for(const [field,label] of [['revenue','营业收入'],['profit','归母净利润'],['ocf','经营现金流']]){const input=version.id+'-'+field;result.push({id:input+'-value',label:'五粮液 2025 前三季度'+versionLabel+label,value:value(input),unit:'CNY',formula:'同一报告版本的合并报表原始字段；不跨版本混用',inputs:[input]})}
 }
 return result;
}
export const metrics=buildMetrics();
export const metric=(id:string)=>metrics.find(m=>m.id===id);

export function routeQuestion(question:string):ResearchTask {
 if(/(?:分析|诊断|研究)(?:一下)?(?:银行|保险公司|券商|宁德|比亚迪|腾讯控股)|招商银行|平安银行|茅台以外|五粮液.*诊断/.test(question))return {intent:'scope',dimensions:[],explanation:'首版仅支持贵州茅台深度诊断。同行用于比较，不支持独立诊断；金融公司需要专门指标体系。',restricted:true};
 if(/买入|卖出|满仓|涨停|明天.*涨|目标价|收益保证/.test(question))return {intent:'boundary',dimensions:['风险'],explanation:'产品提供证据研究，不生成直接交易指令、确定性涨跌预测或收益承诺。可继续核验经营与估值证据。',restricted:true};
 const cash=/现金|回款|利润|经营|收入|银行存款/.test(question);
 const valuation=/估值|便宜|昂贵|贵不贵|贵吗|同行|行业|市盈率|\bPE\b/i.test(question);
 const event=/事件|公告|行情|股价|走势|市场|更正|修订|更新/.test(question);
 const selected=[cash,valuation,event].filter(Boolean).length;
 const ds=[...(cash?['经营质量','财务趋势']:[]),...(valuation?['估值','行业位置','财务趋势']:[]),...(event?['重要事件','行情特征']:[]),'风险'];
 if(selected>1)return {intent:'overview',dimensions:[...new Set(ds)],explanation:'问题涉及多个方面，合并对应研究维度。市场数据为同日公开快照，财务使用已披露期次；不把相关关系认定为因果。',restricted:false};
 if(cash)return {intent:'cash',dimensions:['经营质量','财务趋势','风险'],explanation:'检查利润与现金流一致性，并核验财务公司对合并口径的影响。当前主要对比 2026 前三季度和上年同期。',restricted:false};
 if(valuation)return {intent:'peers',dimensions:['估值','行业位置','财务趋势','风险'],explanation:'分别计算 TTM 与同年度静态市盈率，检查业务、收入确认与样本代表性；倍数不能单独证明低估。',restricted:false};
 if(event)return {intent:'event',dimensions:['重要事件','行情特征','风险'],explanation:'先核验披露与数据版本，再看共同交易日的价格表现；日期对齐与相关性均不能证明事件因果。',restricted:false};
 return {intent:'overview',dimensions:['经营质量','财务趋势','行业位置','风险'],explanation:'按综合研究处理，优先检查经营、趋势、同行和风险。可限定现金流、估值或事件问题。',restricted:false};
}

export function buildClaims():Claim[] {
 const p=(id:string)=>format(metric(id)?.value??null);
 return [
 {id:'C-risk',title:'关键风险在于判断所依赖的证据边界',body:'季度财务信息未经审计，合并财务公司影响尚未完整拆分，渠道收入也不能替代终端动销。当前研究需要保留这些限制。',stance:'unknown',kind:'分析推断',dimension:'风险',metrics:[],notes:['N-audit','N-channel','N-cash'],limitation:'这里描述研究结论的脆弱性，不将信息不足认定为公司已经发生财务或经营问题。',next:'核验后续审计结果、业务现金流拆分及同口径渠道资料，检查结论是否需要调整。'},
 {id:'C-cash',title:'现金流显著增长，但不等于主业回款同比翻倍',body:`2026 前三季度经营现金流同比 ${p('9M-ocf-yoy')}，销售商品、提供劳务收到的现金同比 ${p('9M-salesCash-yoy')}。两者增幅差异明显，公司披露的现金流变动解释涉及财务公司业务。`,stance:'conflict',kind:'分析推断',dimension:'经营质量',metrics:['9M-ocf-yoy','9M-salesCash-yoy','bank-delta'],notes:['N-cash'],limitation:'合并现金流包含财务公司。不能用这两项增幅差直接计算“剔除财务公司后的酒类现金流”，销售回款也并非终端实际动销。',next:'核验财务公司现金流与酒类经营现金流的分部拆分，检查同业存款和成员存款变化。'},
 {id:'C-revenue',title:'前三季度收入增长，归母利润尚未同步增长',body:`同口径累计期营业收入同比 ${p('9M-revenue-yoy')}，归母净利润同比 ${p('9M-parentProfit-yoy')}。收入增长与利润变化的方向不同。`,stance:'negative',kind:'事实',dimension:'财务趋势',metrics:['9M-revenue-yoy','9M-parentProfit-yoy','20269M-margin'],notes:['N-audit'],limitation:'这里比较的是 1—9 月累计期，不是第三季度单季；原因需要结合成本、费用和产品结构进一步核验。',next:'查看产品结构与成本费用明细，核验哪些因素使收入与利润变化不同步。'},
 {id:'C-coverage',title:'合并经营现金流高于合并净利润',body:`本期合并经营现金流 / 合并净利润为 ${format(metric('20269M-cash-ratio')?.value??null,'times')} 倍。合并范围一致，分母包含少数股东损益。`,stance:'positive',kind:'事实',dimension:'经营质量',metrics:['20269M-cash-ratio'],notes:['N-cash'],limitation:'该比值是合并报表事实，不足以证明酒类主业盈利质量改善；财务公司使跨行业比较受限。',next:'分拆财务公司影响，再检查主业现金回收与利润的关系。'},
 {id:'C-annual',title:'年度与最新累计期，应放在各自口径下阅读',body:`2025 年收入同比 ${p('2025-revenue-yoy')}、经营现金流同比 ${p('2025-ocf-yoy')}；2026 前三季度现金流恢复不代表全年走势已经确定。`,stance:'negative',kind:'分析推断',dimension:'财务趋势',metrics:['2025-revenue-yoy','2025-ocf-yoy','9M-ocf-yoy'],notes:['N-annual','N-audit'],limitation:'年度与九个月金额不直接比较规模；2026 三季报未经审计，不能替代全年结果。',next:'跟踪第四季度现金流与全年审计披露，验证本次改善是否持续。'},
 {id:'C-channel',title:'渠道收入可追溯，终端动销仍是信息缺口',body:'报告披露了直销、批发代理与 i 茅台收入，但这些材料不能直接回答终端库存、真实开瓶或消费者购买的变化。',stance:'unknown',kind:'未验证',dimension:'重要事件',metrics:[],notes:['N-channel'],limitation:'缺少可验证的终端库存与动销数据。不将渠道收入变化推断为终端需求同幅变化。',next:'寻找口径明确、可以核验的终端动销与渠道库存资料，记录时点和覆盖范围。'},
 {id:'C-value',title:'估值倍数可以计算，合理性仍不能直接下结论',body:`基于同日公开市值与已披露财务数据，PE TTM 为 ${format(metric('market-pe-ttm')?.value??null,'times')} 倍，PB 为 ${format(metric('market-pb')?.value??null,'times')} 倍。倍数本身不证明低估或高估。`,stance:'unknown',kind:'分析推断',dimension:'估值',metrics:['market-pe-ttm','market-pb'],notes:[],limitation:'行情为腾讯公开快照，非扶摇实时接入；PB 使用最近披露权益，具有报告期滞后。同行仅比较统一年度静态倍数，不混用 TTM。',next:'核验业务增长、风险和同行可比性；接入指定数据服务交叉验证市值及口径。'},
 {id:'C-peer',title:'同行样本存在收入确认差异，不能机械排名',body:'已核验三家白酒同行的年度数据。五粮液披露收入确认核算调整，默认从同比中位数中排除；其余样本不足三家，不生成同行分位。',stance:'conflict',kind:'分析推断',dimension:'行业位置',metrics:['000858.SZ-revenue-yoy'],notes:['N-wly'],limitation:'香型、价格带和财务公司业务不同，小样本不能代表全行业；仅比较 2025 年年度数据。',next:'扩充口径一致的同行，并检查收入确认变化对跨期比较的影响。'},
 {id:'C-price',title:'区间表现可复核，事件因果关系仍未证实',body:`最近 20 个共同交易日，个股前复权价格表现为 ${p('sh600519-return-20')}，沪深300 点位变化为 ${p('sh000300-return-20')}。使用对齐日期，避免错配区间。`,stance:'unknown',kind:'分析推断',dimension:'行情特征',metrics:['sh600519-return-20','sh000300-return-20','sh600519-drawdown-20'],notes:[],limitation:'公开供应商前复权价格的收益口径不等于分红再投资总回报；没有因果识别，不能说公告造成上涨或下跌。',next:'查看公告前后的明确交易区间，核验其他同期信息和基准变化，保留因果不确定性。'},
 ];
}
export const claims=buildClaims();
export function selectClaims(task:ResearchTask,challenge=false):Claim[]{if(task.restricted)return [];const selected=claims.filter(c=>task.dimensions.includes(c.dimension)||c.dimension==='风险');return challenge?selected.filter(c=>c.stance!=='positive'):selected;}
export function peers(exclude:string[]=['000858.SZ']) {return [{code:'600519.SH',name:'贵州茅台',prefix:'',note:'酱香；合并财务公司'},{code:'000568.SZ',name:'泸州老窖',prefix:'000568.SZ-',note:'浓香；价格带与结构不同'},{code:'600809.SH',name:'山西汾酒',prefix:'600809.SH-',note:'清香；地域与渠道结构不同'},{code:'000858.SZ',name:'五粮液',prefix:'000858.SZ-',note:'收入确认核算调整，默认排除'}].map(p=>({...p,revenue:value(p.prefix+'2025-revenue'),profit:value(p.prefix+'2025-parentProfit'),roe:value(p.prefix+'2025-roe'),growth:metric(p.prefix?p.code+'-revenue-yoy':'2025-revenue-yoy')?.value??null,excluded:exclude.includes(p.code)}));}
export function validateClaimsEvidence(output:{text:string;evidenceIds:string[]}[]):string[] {
 const valid=new Set([...metrics.map(m=>m.id),...notes.map(n=>n.id)]);const errors:string[]=[];
 for(const c of output){if(!c.evidenceIds.length)errors.push('结论缺少证据');for(const id of c.evidenceIds)if(!valid.has(id))errors.push('无效证据引用');if(/买入|卖出|满仓|必涨|保证收益|行业第一/.test(c.text))errors.push('超出允许的结论范围');}
 return errors;
}
